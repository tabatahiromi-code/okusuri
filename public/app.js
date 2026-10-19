import { setupNavigation } from './navigation.js';
import { setupJsonImport } from './import.js';
import { parseSticker } from './parser.js';
import { createImageCropper } from './crop.js';
import { OCR_MODEL, normalizeOcrText, prepareImage } from './ocr-utils.js';
const $ = s => document.querySelector(s);
const editor = $('#editor'), form = $('#record-form'), camera = $('#camera-dialog');
const chooseImage = createImageCropper($('#crop-dialog'), readImage, toast);
let records = [], editId = null, stream = null, worker = null, ocrGeneration = 0, photoUrl = null, saving = false, loaded = false;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const dateLabel = date => date ? date.replaceAll('-', '.') : '—';
function element(tag, className, value) { const el = document.createElement(tag); if(className) el.className=className; if(value !== undefined) el.textContent=value; return el; }
function toast(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('#toast').hidden=true,4000); }
async function api(path, options) { const res = await fetch('/api/records'+path, options); let data; try { data = await res.json(); } catch { throw new Error('サーバーの応答を確認できません。公開設定を確認してください。'); } if(!res.ok) throw new Error(data.error || '接続できませんでした。'); return data; }
async function load() { try { records=await api(''); loaded=true; $('#connection').replaceChildren(); render(); } catch(error) { loaded=false; $('#connection').textContent=error.message; const retry=element('button','text-btn','再読み込み'); retry.onclick=load; $('#connection').append(retry); $('#record-list').replaceChildren(element('div','empty','記録を取得できませんでした。接続を確認して再試行してください。')); } }
function render() {
  $('#record-count').replaceChildren(document.createTextNode(records.length),element('em','','件'));
  $('#medicine-count').replaceChildren(document.createTextNode(new Set(records.flatMap(r=>r.medicines.map(m=>m.name))).size),element('em','','種類'));
  $('#latest-date').textContent=dateLabel(records.map(r=>r.date).sort().at(-1)); $('#list-count').textContent=`${records.length}件`;
  const q=$('#search').value.trim().toLowerCase(); const direction=$('#sort').value==='asc'?1:-1;
  const visible=records.filter(r=>JSON.stringify([r.clinic,r.pharmacy,r.medicines,r.note,r.originalText]).toLowerCase().includes(q)).sort((a,b)=>direction*a.date.localeCompare(b.date));
  const list=$('#record-list'); list.replaceChildren();
  if(!visible.length) { const empty=element('div','empty'); empty.append(element('strong','',q?'見つかりませんでした':'最初の1枚から、はじめましょう。'),element('div','',q?'別の薬名や医療機関名で検索してください。':'お薬のシールを撮影して、記録を追加できます。')); if(!q) { const b=element('button','text-btn','＋ カメラで読み取る'); b.onclick=startCamera; empty.append(b); } list.append(empty); }
  for(const r of visible) { const card=element('article','record-card'), top=element('div','record-top'), info=element('div'), actions=element('div','record-actions'); info.append(element('div','record-date',dateLabel(r.date)),element('div','record-place',[r.clinic,r.pharmacy].filter(Boolean).join(' ／ ')||'医療機関・薬局は未入力')); const edit=element('button','','編集'); edit.onclick=()=>openEditor(r); const remove=element('button','','削除'); remove.onclick=()=>deleteRecord(r); actions.append(edit,remove); top.append(info,actions); card.append(top);
    for(const m of r.medicines) { const row=element('div','medicine'), copy=element('div'); copy.append(element('b','',m.name),element('p','',m.dosage||'用法・用量の記録なし')); row.append(copy); card.append(row); }
    if(r.note) { const note=element('details','record-memo'); note.append(element('summary','','メモを表示'),element('div','record-note',r.note)); card.append(note); } if(r.originalText) { const details=element('details'); details.append(element('summary','','シールの読み取り文章'),element('p','record-note',r.originalText)); card.append(details); } list.append(card);
  }
}
function addMedicine(m={name:'',dosage:''}) { const row=element('div','medicine-row'); const remove=element('button','remove-medicine','削除'); remove.type='button'; remove.onclick=()=>{if($('#medicine-fields').children.length>1) row.remove(); else toast('薬名を1つ以上入力してください。');}; row.append(remove); for(const [key,title,placeholder] of [['name','薬名（必須）','シールに書かれた薬名・規格'],['dosage','用法・用量','例：1回1錠、1日3回 毎食後、7日分']]) { const label=element('label','',title), input=document.createElement('input'); input.dataset.field=key; input.value=m[key]||''; input.placeholder=placeholder; input.required=key==='name'; input.maxLength=key==='name'?500:1000; label.append(input); row.append(label); } $('#medicine-fields').append(row); }
function setMedicines(medicines) { $('#medicine-fields').replaceChildren(); (medicines.length?medicines:[{}]).forEach(addMedicine); }
function clearPhoto() { if(photoUrl) URL.revokeObjectURL(photoUrl); photoUrl=null; $('#preview').hidden=true; $('#preview').removeAttribute('src'); }
function openEditor(record=null) { editId=record?.id||null; form.reset(); $('#form-error').textContent=''; $('#ocr-state').textContent=''; $('#ocr-progress').hidden=true; clearPhoto(); $('#original-details').open=false; $('#editor-title').textContent=record?'お薬の記録を編集':'お薬の記録を追加'; for(const key of ['date','clinic','pharmacy','note','originalText']) form.elements[key].value=record?.[key]||(key==='date'?today():''); setMedicines(record?.medicines||[]); $('#save').disabled=false; if(!editor.open) editor.showModal(); }
function closeEditor() { if(saving) return; ++ocrGeneration; if(worker) { worker.terminate(); worker=null; } clearPhoto(); editor.close(); }
function stopCamera() { if(stream) stream.getTracks().forEach(t=>t.stop()); stream=null; $('#camera-video').srcObject=null; }
function closeCamera() { stopCamera(); camera.close(); }
async function startCamera() { $('#camera-status').textContent='カメラを起動しています…'; $('#take-photo').disabled=true; camera.showModal(); if(!navigator.mediaDevices?.getUserMedia) { $('#camera-status').textContent='このブラウザでは直接起動できません。「端末のカメラを使う」を選んでください。'; return; } try { const active=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:2560},height:{ideal:1920}},audio:false}); if(!camera.open) { active.getTracks().forEach(t=>t.stop()); return; } stream=active; $('#camera-video').srcObject=active; await $('#camera-video').play(); $('#take-photo').disabled=false; $('#camera-status').textContent='シール全体を大きく写し、影や反射を避けてください。'; } catch { $('#camera-status').textContent='カメラを起動できませんでした。カメラの使用を許可するか、端末のカメラ・画像からの読み取りをお使いください。'; } }
async function takePhoto() { const v=$('#camera-video'); if(!v.videoWidth) return; const c=document.createElement('canvas'); c.width=v.videoWidth; c.height=v.videoHeight; c.getContext('2d').drawImage(v,0,0); const blob=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.95)); closeCamera(); if(blob) chooseImage(blob); }
async function readImage(file) {
  if(!file || (file.type && !file.type.startsWith('image/'))) return toast('画像を選択してください。');
  if(file.size>25*1024*1024) return toast('25MB以下の画像を選択してください。');
  openEditor(); const generation=++ocrGeneration; photoUrl=URL.createObjectURL(file); $('#preview').src=photoUrl; $('#preview').hidden=false;
  $('#ocr-state').textContent='文字認識を準備中です。初回は少し時間がかかります。'; $('#ocr-progress').hidden=false; $('#save').disabled=true;
  let activeWorker;
  try {
    const image = new Image(); image.src=photoUrl; await image.decode();
    const canvas=prepareImage(image);
    activeWorker=await Tesseract.createWorker(OCR_MODEL.language,1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr/core',langPath:OCR_MODEL.langPath,cachePath:OCR_MODEL.cachePath,workerBlobURL:false,logger:m=>{if(generation!==ocrGeneration)return; const progress=Math.max(0,Math.min(1,m.progress||0)); $('#ocr-progress').value=progress; $('#ocr-state').textContent=m.status==='recognizing text'?`文字を読み取り中… ${Math.round(progress*100)}%`:'日本語の文字認識を準備しています…';}});
    if(generation!==ocrGeneration) return; worker=activeWorker;
    await activeWorker.setParameters({preserve_interword_spaces:'0',user_defined_dpi:'300'});
    const {data}=await activeWorker.recognize(canvas,{rotateAuto:true}); if(generation!==ocrGeneration)return;
    const text=normalizeOcrText(data.text);
    form.elements.originalText.value=text; applyCandidates(text,false); $('#original-details').open=true;
    $('#ocr-state').textContent=text?(data.confidence<75?'判読しづらい箇所があります。範囲を絞って撮り直すか、原本を見て修正してください。':'読み取りました。薬名・数字には誤りが残る場合があります。必ずシールと照合してください。'):'文字を読み取れませんでした。明るい場所で撮り直すか、手入力してください。';
  } catch { if(generation===ocrGeneration) { $('#ocr-state').textContent='読み取りできませんでした。画像形式や通信状態を確認して撮り直すか、手入力してください。'; $('#original-details').open=true; } }
  finally { if(activeWorker) await activeWorker.terminate().catch(()=>{}); if(worker===activeWorker) worker=null; if(generation===ocrGeneration) { $('#ocr-progress').hidden=true; $('#save').disabled=false; } }
}
function applyCandidates(text, replace) { const data=parseSticker(text); for(const key of ['date','clinic','pharmacy']) if(data[key]) form.elements[key].value=data[key]; if(data.medicines.length) setMedicines(data.medicines); else if(replace) toast('薬名の候補がありません。原文を見ながら入力してください。'); $('#confirmed').checked=false; }
async function save(event) { event.preventDefault(); if(saving) return; const data=Object.fromEntries(new FormData(form)); data.medicines=[...$('#medicine-fields').children].map(row=>({name:row.querySelector('[data-field=name]').value.trim(),dosage:row.querySelector('[data-field=dosage]').value.trim()})); saving=true; $('#save').disabled=true; $('#save').textContent='保存しています…'; $('#form-error').textContent=''; try { const saved=await api(editId?'/'+editId:'',{method:editId?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); records=records.filter(r=>r.id!==saved.id).concat(saved); saving=false; closeEditor(); toast('お薬の記録を保存しました。'); if(loaded) render(); else await load(); } catch(error) { $('#form-error').textContent=error.message+' 入力内容はこの画面に残っています。'; } finally { saving=false; $('#save').disabled=false; $('#save').textContent='確認して保存'; } }
async function deleteRecord(r) { if(!confirm(`${dateLabel(r.date)}の記録を削除しますか？この操作は取り消せません。`))return; try { await api('/'+r.id,{method:'DELETE'}); records=records.filter(item=>item.id!==r.id); render(); toast('記録を削除しました。'); } catch(error) {toast(error.message);} }
function exportRecords() { if(!loaded) return toast('記録を取得してからお試しください。'); const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),records},null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=element('a'); a.href=url; a.download=`okusuri-${today()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
$('#add').onclick=()=>openEditor(); $('#scan').onclick=startCamera; $('#upload').onclick=()=>$('#image-file').click(); $('#close-camera').onclick=closeCamera; $('#take-photo').onclick=takePhoto;
$('#fallback-camera').onclick=()=>{closeCamera();$('#camera-file').click();};
for(const selector of ['#image-file','#camera-file']) $(selector).onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)chooseImage(file);};
$('#close-editor').onclick=$('#cancel-edit').onclick=closeEditor; editor.addEventListener('cancel',e=>{e.preventDefault();closeEditor();}); camera.addEventListener('cancel',e=>{e.preventDefault();closeCamera();});
$('#add-medicine').onclick=()=>{if($('#medicine-fields').children.length<50)addMedicine();else toast('1件に保存できるお薬は50種類までです。');}; $('#parse-text').onclick=()=>{if($('#medicine-fields input').value.trim()&&!confirm('現在の入力を文章からの候補で置き換えますか？'))return;applyCandidates(form.elements.originalText.value,true);};
form.onsubmit=save; $('#search').oninput=()=>{if(loaded)render();}; $('#sort').onchange=()=>{if(loaded)render();}; $('#export').onclick=exportRecords;
editor.addEventListener('close',()=>{++ocrGeneration; if(worker){worker.terminate();worker=null;}clearPhoto();}); camera.addEventListener('close',stopCamera); window.addEventListener('pagehide',stopCamera);
setupNavigation();
setupJsonImport({api,load,getRecords:()=>records,toast,element,dateLabel});
load();
