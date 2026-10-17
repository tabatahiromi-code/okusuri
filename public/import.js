import { parseImport, recordFingerprint } from './record-format.js';
export function setupJsonImport({api,load,getRecords,toast,element,dateLabel}) {
  const dialog=document.querySelector('#import-dialog'),fileInput=document.querySelector('#import-file'),preview=document.querySelector('#import-preview'),error=document.querySelector('#import-error'),submit=document.querySelector('#import-save'),confirmed=document.querySelector('#import-confirmed'),paste=document.querySelector('#import-paste');
  let entries=[],busy=false;
  function update(){submit.disabled=busy||!confirmed.checked||!entries.some(e=>e.checkbox.checked&&!e.checkbox.disabled);}
  function reset(){entries=[];preview.replaceChildren();error.textContent='';confirmed.checked=false;update();}
  function open(){reset();paste.value='';fileInput.value='';document.querySelector('#import-file-name').textContent='';dialog.showModal();}
  function show(text){
    reset();if(text.length>2000000)throw new Error('2MB以下のJSONを選択してください。');
    let data;try{data=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new Error('JSONの形式を確認してください。');}
    const items=parseImport(data),existing=getRecords(),seen=new Set(existing.map(recordFingerprint));
    for(const [i,r] of items.entries()) {
      const duplicate=seen.has(recordFingerprint(r));seen.add(recordFingerprint(r));
      const card=element('article','record-card'),label=element('label','import-choice'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=!duplicate;checkbox.disabled=duplicate;
      label.append(checkbox,document.createTextNode(`${i+1}. ${dateLabel(r.date)} ／ ${r.medicines.length}種類`));card.append(label);
      card.append(element('p','record-place',[r.clinic||'医療機関は未入力',r.pharmacy||'薬局は未入力'].join(' ／ ')));
      if(duplicate)card.append(element('p','import-notice','同じ内容の記録があるため、取り込みをスキップします。'));
      else if(existing.some(e=>e.date===r.date))card.append(element('p','import-notice','同じ処方日の記録があります。別の記録として追加します。既存の記録は編集・削除の操作で整理できます。'));
      for(const m of r.medicines){const row=element('div','medicine'),copy=element('div');copy.append(element('b','',m.name),element('p','',m.dosage||'用法・用量は未入力。原本を確認して編集してください。'));row.append(copy);card.append(row);}
      if(r.note)card.append(element('p','record-note',r.note));
      if(r.originalText){const details=element('details');details.append(element('summary','','抽出した原文'),element('p','record-note',r.originalText));card.append(details);}
      checkbox.onchange=update;entries.push({record:r,checkbox});preview.append(card);
    }
    update();
  }
  document.querySelector('#import-open').onclick=open;
  document.querySelector('#import-pick').onclick=()=>fileInput.click();
  fileInput.onchange=async()=>{const file=fileInput.files[0];if(!file)return;reset();try{if(file.size>2000000)throw new Error('2MB以下のJSONファイルを選択してください。');document.querySelector('#import-file-name').textContent=file.name;show(await file.text());}catch(e){error.textContent=e.message;}finally{fileInput.value='';}};
  document.querySelector('#import-paste-preview').onclick=()=>{try{document.querySelector('#import-file-name').textContent='貼り付けたJSON';show(paste.value);}catch(e){error.textContent=e.message;}};
  confirmed.onchange=update;
  document.querySelector('#import-close').onclick=()=>{if(!busy)dialog.close();};
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  submit.onclick=async()=>{
    if(busy||!confirmed.checked)return;const selected=entries.filter(e=>e.checkbox.checked&&!e.checkbox.disabled).map(e=>e.record);if(!selected.length)return;
    busy=true;update();error.textContent='';submit.textContent='取り込んでいます…';
    try{const result=await api('/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:1,records:selected})});dialog.close();await load();toast(`${result.imported}件を取り込みました。${result.skipped?` 同じ内容の${result.skipped}件はスキップしました。`:''}`);}catch(e){error.textContent=e.message;}finally{busy=false;submit.textContent='選択した記録を取り込む';update();}
  };
}
