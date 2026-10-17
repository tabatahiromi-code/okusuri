const response = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
import { validateRecord, parseImport } from '../public/record-format.js';
export { validateRecord };
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const user = request.headers.get('oai-authenticated-user-id');
    if (!user) return response({ error: 'ChatGPTにサインインしてください。' }, 401);
    if (!env.DB) return response({ error: '保存先がまだ設定されていません。公開設定の完了後に利用できます。' }, 503);
    if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('origin') !== url.origin) return response({ error: '許可されていないリクエストです。' }, 403);
    if(url.pathname === '/api/records/import') {
      if(request.method!=='POST') return response({error:'対応していない操作です。'},405);
      if(!request.headers.get('content-type')?.includes('application/json')) return response({error:'JSON形式で送信してください。'},415);
      const body=await request.text();
      if(body.length>2000000) return response({error:'2MB以下のJSONファイルを選択してください。'},413);
      let input;try{input=JSON.parse(body);}catch{return response({error:'JSONファイルを読み取れませんでした。'},400);}
      let items;try{items=parseImport(input);}catch(error){return response({error:error.message},400);}
      try{
        const now=new Date().toISOString();
        // Atomic batch: validate the entire file before writing. The predicate also handles retries and concurrent imports.
        const statements=items.map(r=>{
          const values=[user,r.date,r.clinic,r.pharmacy,JSON.stringify(r.medicines),r.originalText,r.note];
          return env.DB.prepare('INSERT INTO records (id,user_id,prescription_date,clinic,pharmacy,medicines,original_text,note,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM records WHERE user_id=? AND prescription_date=? AND clinic=? AND pharmacy=? AND medicines=? AND original_text=? AND note=?)').bind(crypto.randomUUID(),...values,now,now,...values);
        });
        const results=await env.DB.batch(statements);
        const imported=results.reduce((sum,r)=>sum+(r.meta.changes||0),0);
        return response({imported,skipped:items.length-imported});
      }catch{return response({error:'取り込みに失敗しました。記録を再読み込みしてから、同じファイルで再試行できます。'},500);}
    }
    const match = url.pathname.match(/^\/api\/records(?:\/([\w-]+))?$/);
    if (!match) return response({ error: '見つかりません。' }, 404);
    const id = match[1];
    try {
      if (request.method === 'GET' && !id) {
        const { results } = await env.DB.prepare('SELECT * FROM records WHERE user_id = ? ORDER BY prescription_date DESC, created_at DESC').bind(user).all();
        return response(results.map(r => ({ id: r.id, date: r.prescription_date, clinic: r.clinic, pharmacy: r.pharmacy, medicines: JSON.parse(r.medicines), originalText: r.original_text, note: r.note })));
      }
      if (request.method === 'DELETE' && id) {
        const result = await env.DB.prepare('DELETE FROM records WHERE id = ? AND user_id = ?').bind(id, user).run();
        return result.meta.changes ? response({ ok: true }) : response({ error: '記録が見つかりません。' }, 404);
      }
      if ((request.method === 'POST' && !id) || (request.method === 'PUT' && id)) {
        if (!request.headers.get('content-type')?.includes('application/json')) return response({ error: 'JSON形式で送信してください。' }, 415);
        const body = await request.text();
        if (body.length > 100000) return response({ error: '内容が長すぎます。' }, 413);
        let input; try { input = JSON.parse(body); } catch { return response({ error: '内容を確認してください。' }, 400); }
        const data = validateRecord(input);
        if (!data) return response({ error: '処方日と薬名を確認してください。' }, 400);
        const recordId = id || crypto.randomUUID();
        const now = new Date().toISOString();
        if (id) {
          const result = await env.DB.prepare('UPDATE records SET prescription_date=?, clinic=?, pharmacy=?, medicines=?, original_text=?, note=?, updated_at=? WHERE id=? AND user_id=?').bind(data.date,data.clinic,data.pharmacy,JSON.stringify(data.medicines),data.originalText,data.note,now,id,user).run();
          if (!result.meta.changes) return response({ error: '記録が見つかりません。' }, 404);
        } else {
          await env.DB.prepare('INSERT INTO records (id,user_id,prescription_date,clinic,pharmacy,medicines,original_text,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(recordId,user,data.date,data.clinic,data.pharmacy,JSON.stringify(data.medicines),data.originalText,data.note,now,now).run();
        }
        return response({ id: recordId, ...data }, id ? 200 : 201);
      }
      return response({ error: '対応していない操作です。' }, 405);
    } catch { return response({ error: '保存先に接続できませんでした。時間をおいて再試行してください。' }, 500); }
  }
};
