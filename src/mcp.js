import { parseImport } from '../public/record-format.js';
import { importRecords } from './records-store.js';
const recordSchema={type:'object',additionalProperties:false,properties:{date:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$',description:'処方日。画像に書かれた日付をYYYY-MM-DDで指定。'},clinic:{type:'string',maxLength:3000},pharmacy:{type:'string',maxLength:3000},originalText:{type:'string',maxLength:30000},note:{type:'string',maxLength:3000,description:'判読できない項目や写真外の部分は推測せず、このメモに明記する。'},medicines:{type:'array',minItems:1,maxItems:50,items:{type:'object',additionalProperties:false,properties:{name:{type:'string',minLength:1,maxLength:500},dosage:{type:'string',maxLength:1000,description:'画像から確定できる用法・用量のみ。不明なら空文字列。'}},required:['name','dosage']}}},required:['date','clinic','pharmacy','originalText','note','medicines']};
const recordsSchema={type:'array',minItems:1,maxItems:100,items:recordSchema};
export const tools=[
 {name:'get_notebook_status',title:'お薬手帳の接続を確認',description:'本人のお薬手帳への接続と記録件数を確認する読み取り専用ツール。接続テストにはこれを使う。薬名などの内容は返さない。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
 {name:'preview_medicine_records',title:'登録前のお薬の記録を確認',description:'チャットでシール画像から抽出した記録の形式を確認し、保存せずにプレビューと確認トークンを返す。写真にない情報、判読できない薬名や用量を推測で補わない。抽出結果と未確認項目をユーザーに提示すること。保存はユーザーが内容を明示的に了承してからsave_medicine_recordsで行う。',inputSchema:{type:'object',additionalProperties:false,properties:{records:recordsSchema},required:['records']},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
 {name:'save_medicine_records',title:'確認済みのお薬の記録を登録',description:'ユーザーがプレビュー内容の登録を明示的に了承した後にのみ使用する。preview_medicine_recordsが返したpreview_tokenと同じrecordsを渡し、confirmed:trueを指定する。変更した場合は再プレビューが必要。本人の記録へ追加し、同じ内容はスキップする。既存の記録を変更・削除しない。',inputSchema:{type:'object',additionalProperties:false,properties:{records:recordsSchema,preview_token:{type:'string',pattern:'^[a-f0-9]{64}$'},confirmed:{type:'boolean',const:true,description:'ユーザーが抽出結果と未確認項目を確認し、登録を明示的に了承した場合のみtrue。'}},required:['records','preview_token','confirmed']},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}}
];
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const rpc=(id,result)=>json({jsonrpc:'2.0',id,result});
const rpcError=(id,code,message,status=200)=>json({jsonrpc:'2.0',id,error:{code,message}},status);
const toolContent=value=>({content:[{type:'text',text:JSON.stringify(value)}]});
async function previewToken(user,records){
  // Binds the preview to this Site identity and the exact normalized payload without storing medical data in a session.
  const bytes=new TextEncoder().encode('okusuri-preview-v1\0'+user+'\0'+JSON.stringify(records));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function handleMcp(request,env){
  if(request.method!=='POST')return new Response('POST only',{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});
  if(request.headers.has('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'許可されていないリクエストです。'},403);
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'JSON形式で送信してください。'},415);
  let message;try{const body=await request.text();if(body.length>2000000)return json({error:'記録のサイズが大きすぎます。'},413);message=JSON.parse(body);}catch{return rpcError(null,-32700,'Parse error',400);}
  if(!message||Array.isArray(message)||message.jsonrpc!=='2.0'||typeof message.method!=='string'||('id'in message&&!['string','number'].includes(typeof message.id)&&message.id!==null))return rpcError(null,-32600,'Invalid Request',400);
  // Notifications never cause writes.
  if(!Object.hasOwn(message,'id'))return new Response(null,{status:204});
  const {id,method,params}=message;
  if(method==='server/discover')return rpc(id,{supportedVersions:['2026-07-28','2025-06-18'],capabilities:{tools:{}}});
  if(method==='initialize')return rpc(id,{protocolVersion:params?.protocolVersion==='2025-06-18'?'2025-06-18':'2026-07-28',serverInfo:{name:'okusuri-notebook',version:'1.0.0'},capabilities:{tools:{}},instructions:'シール画像の抽出結果をプレビューし、ユーザーの明示的な了承後に登録してください。薬名・用量は推測しないでください。'});
  if(method==='ping')return rpc(id,{});
  if(method==='tools/list')return rpc(id,{tools});
  if(method!=='tools/call')return rpcError(id,-32601,'Method not found');
  const user=request.headers.get('oai-authenticated-user-id');
  if(!user)return rpcError(id,-32001,'ChatGPTの本人アカウントで接続してください。',401);
  if(!env.DB)return rpcError(id,-32002,'保存先に接続できません。',503);
  const args=params?.arguments??{};
  try{
    if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('入力形式を確認してください。');
    if(params?.name==='get_notebook_status'){
      try{const row=await env.DB.prepare('SELECT COUNT(*) AS count FROM records WHERE user_id = ?').bind(user).first();return rpc(id,toolContent({connected:true,record_count:row?.count??0}));}catch{return rpc(id,{isError:true,content:[{type:'text',text:'記録件数を取得できませんでした。'}]});}
    }
    if(!['preview_medicine_records','save_medicine_records'].includes(params?.name))throw new Error('対応していないツールです。');
    const records=parseImport({version:1,records:args.records});
    const token=await previewToken(user,records);
    if(params.name==='preview_medicine_records')return rpc(id,toolContent({status:'preview_only',confirmation_required:true,preview_token:token,records,instructions:'まだ保存していません。内容と未確認項目をユーザーに提示し、明示的な了承を得てから同じ内容を登録してください。'}));
    if(args.confirmed!==true)throw new Error('登録前にユーザーによる内容の確認と明示的な了承が必要です。');
    if(args.preview_token!==token)throw new Error('確認した内容と一致しません。このユーザーで同じ記録を再プレビューしてください。');
    try{return rpc(id,toolContent({status:'saved',...await importRecords(env.DB,user,records)}));}catch{return rpc(id,{isError:true,content:[{type:'text',text:'保存に失敗しました。接続を確認して再試行してください。同じ内容の再送は重複保存しません。'}]});}
  }catch(error){return rpc(id,{isError:true,content:[{type:'text',text:error.message}]});}
}
