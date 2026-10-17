import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from 'tesseract.js';
import { fileURLToPath } from 'node:url';
import { OCR_MODEL, normalizeOcrText } from '../public/ocr-utils.js';
import { parseSticker } from '../public/parser.js';
// Generated labels contain no real patient information. Exercise the actual WASM engine and bundled model.
test('日本語薬名・日付・用量を、鮮明・小サイズ・傾いたシール画像から読み取る',async()=>{
 const worker=await createWorker(OCR_MODEL.language,1,{langPath:fileURLToPath(new URL('../public/ocr/japanese-v2/',import.meta.url)),cacheMethod:'none'});
 try {
  await worker.setParameters({preserve_interword_spaces:'0',user_defined_dpi:'300'});
  for(const name of ['sticker-clear.png','sticker-small.png','sticker-tilted.png']){
   const {data}=await worker.recognize(fileURLToPath(new URL('./fixtures/'+name,import.meta.url)),{rotateAuto:true});
   const result=parseSticker(normalizeOcrText(data.text));
   assert.equal(result.date,'2026-10-17',name);assert.equal(result.pharmacy,'あおぞら薬局',name);
   const names=result.medicines.map(m=>m.name.replace(/\s/g,''));
   for(const expected of ['アムロジピン錠5mg','ロキソプロフェンNa錠60mg','レバミピド錠100mg'])assert.ok(names.some(n=>n.includes(expected)),`${name}: ${expected}`);
   assert.ok(result.medicines[0].dosage.includes('1回1錠1日1回朝食後28日分'),name);
  }
 }finally{await worker.terminate();}
});
