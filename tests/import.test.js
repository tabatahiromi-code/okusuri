import test from 'node:test';
import assert from 'node:assert/strict';
import { parseImport } from '../public/record-format.js';
import worker from '../src/worker.js';
const sample={date:'2026-09-28',clinic:'テスト医院',pharmacy:'',originalText:'',note:'下書き：用量未確認',medicines:[{name:'テスト錠5mg',dosage:''}]};
const request=body=>new Request('https://example.com/api/records/import',{method:'POST',headers:{'origin':'https://example.com','oai-authenticated-user-id':'current-user','content-type':'application/json'},body:JSON.stringify(body)});
test('バックアップ形式とチャット下書きを受理し、外部ID・所有者を破棄する',()=>{const parsed=parseImport({version:1,records:[{...sample,id:'someone-else',user_id:'other'}]});assert.deepEqual(parsed,[sample]);});
test('一件でも不正なら書き込み前にファイル全体を拒否する',async()=>{let writes=0;const res=await worker.fetch(request({version:1,records:[sample,{...sample,date:'2026-02-30'}]}),{DB:{batch(){writes++;}}});assert.equal(res.status,400);assert.equal(writes,0);});
test('形式や取り込み件数を検証する',()=>{assert.throws(()=>parseImport({version:2,records:[sample]}));assert.throws(()=>parseImport({version:1,records:[]}));assert.throws(()=>parseImport({version:1,records:Array(101).fill(sample)}));assert.throws(()=>parseImport({version:1,records:[{...sample,medicines:[{name:'',dosage:''}]}]}));});
test('所有者の範囲で追加のみ行い、ファイル内・再試行時の重複をスキップする',async()=>{
 let batchCount=0;const seen=new Set(),DB={prepare(sql){assert.match(sql,/INSERT INTO records/);assert.match(sql,/WHERE NOT EXISTS/);assert.match(sql,/WHERE user_id=\?/);assert.ok(!/UPDATE|DELETE/.test(sql));return{bind(...params){assert.equal(params[1],'current-user');assert.equal(params[10],'current-user');return{params};}}},async batch(statements){batchCount++;return statements.map(({params})=>{const key=JSON.stringify(params.slice(10));const duplicate=seen.has(key);seen.add(key);return{meta:{changes:duplicate?0:1}};});}};
 const first=await worker.fetch(request({version:1,records:[{...sample,id:'other'},sample]}),{DB});assert.deepEqual(await first.json(),{imported:1,skipped:1});assert.equal(batchCount,1);
 const replay=await worker.fetch(request({version:1,records:[sample]}),{DB});assert.deepEqual(await replay.json(),{imported:0,skipped:1});
});
test('匿名・別オリジンからの取り込みを拒否する',async()=>{const anonymous=await worker.fetch(new Request('https://example.com/api/records/import',{method:'POST'}),{DB:{}});assert.equal(anonymous.status,401);const cross=await worker.fetch(new Request('https://example.com/api/records/import',{method:'POST',headers:{origin:'https://attacker.example','oai-authenticated-user-id':'current-user'}}),{DB:{}});assert.equal(cross.status,403);});
test('実際のSQLiteでSQL・重複防止・所有者の分離を確認する',async()=>{
 const {DatabaseSync}=await import('node:sqlite');const {readFileSync}=await import('node:fs');const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/0001_records.sql',import.meta.url),'utf8'));
 const DB={prepare(sql){return{bind(...params){return{sql,params}}};},async batch(statements){db.exec('BEGIN');try{const result=statements.map(({sql,params})=>({meta:{changes:Number(db.prepare(sql).run(...params).changes)}}));db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}};
 try{const first=await worker.fetch(request({version:1,records:[sample,sample]}),{DB});assert.deepEqual(await first.json(),{imported:1,skipped:1});const again=await worker.fetch(request({version:1,records:[sample]}),{DB});assert.deepEqual(await again.json(),{imported:0,skipped:1});assert.equal(db.prepare('SELECT COUNT(*) AS n FROM records').get().n,1);assert.equal(db.prepare('SELECT user_id FROM records').get().user_id,'current-user');
 const another=request({version:1,records:[sample]});another.headers.set('oai-authenticated-user-id','another-user');const differentOwner=await worker.fetch(another,{DB});assert.deepEqual(await differentOwner.json(),{imported:1,skipped:0});assert.equal(db.prepare('SELECT COUNT(*) AS n FROM records').get().n,2);
 }finally{db.close();}
});
