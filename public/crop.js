// The crop is applied locally; no image is uploaded.
export function createImageCropper(dialog, onAccept, onError) {
  const canvas=dialog.querySelector('canvas'), ctx=canvas.getContext('2d');
  const status=dialog.querySelector('[data-crop-status]'), accept=dialog.querySelector('[data-crop-accept]');
  let source=null, selection=null, drag=null, url=null, token=0;
  function release(){++token;source=null;selection=null;drag=null;if(url)URL.revokeObjectURL(url);url=null;}
  function reset(){if(!source)return;selection={x:0,y:0,width:canvas.width,height:canvas.height};draw();}
  function draw(){if(!source)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);const r=selection;ctx.fillStyle='#102e5070';ctx.fillRect(0,0,canvas.width,canvas.height);if(r?.width&&r.height){ctx.save();ctx.beginPath();ctx.rect(r.x,r.y,r.width,r.height);ctx.clip();ctx.drawImage(source,0,0,canvas.width,canvas.height);ctx.restore();ctx.strokeStyle='#67b4ff';ctx.lineWidth=3;ctx.strokeRect(r.x,r.y,r.width,r.height);}}
  function fit(){const scale=Math.min(1,900/Math.max(source.width,source.height));canvas.width=Math.round(source.width*scale);canvas.height=Math.round(source.height*scale);reset();}
  function point(event){const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(canvas.width,(event.clientX-r.left)*canvas.width/r.width)),y:Math.max(0,Math.min(canvas.height,(event.clientY-r.top)*canvas.height/r.height))};}
  canvas.onpointerdown=event=>{if(!source)return;drag=point(event);canvas.setPointerCapture(event.pointerId);event.preventDefault();};
  canvas.onpointermove=event=>{if(!drag)return;const p=point(event);selection={x:Math.min(drag.x,p.x),y:Math.min(drag.y,p.y),width:Math.abs(drag.x-p.x),height:Math.abs(drag.y-p.y)};draw();};
  canvas.onpointerup=()=>{if(!drag)return;drag=null;if(!selection||selection.width<20||selection.height<20)reset();};
  canvas.onpointercancel=()=>{drag=null;reset();};
  dialog.querySelector('[data-crop-reset]').onclick=reset;
  dialog.querySelector('[data-crop-rotate]').onclick=()=>{if(!source)return;const rotated=document.createElement('canvas');rotated.width=source.height;rotated.height=source.width;const c=rotated.getContext('2d');c.translate(rotated.width,0);c.rotate(Math.PI/2);c.drawImage(source,0,0);source=rotated;fit();};
  dialog.querySelector('[data-crop-close]').onclick=()=>dialog.close();
  dialog.addEventListener('close',release);
  accept.onclick=async()=>{if(!source||!selection||drag)return;accept.disabled=true;const r=selection,output=document.createElement('canvas'),ratio=source.width/canvas.width;output.width=Math.max(1,Math.round(r.width*ratio));output.height=Math.max(1,Math.round(r.height*ratio));output.getContext('2d').drawImage(source,r.x*ratio,r.y*ratio,r.width*ratio,r.height*ratio,0,0,output.width,output.height);const generation=token;const blob=await new Promise(resolve=>output.toBlob(resolve,'image/png'));if(generation!==token)return;if(!blob){accept.disabled=false;onError('画像を準備できませんでした。別の写真でお試しください。');return;}dialog.close();onAccept(blob);};
  return async file=>{
    if(!file||(file.type&&!file.type.startsWith('image/')))return onError('画像を選択してください。');
    if(file.size>25*1024*1024)return onError('25MB以下の画像を選択してください。');
    release();const generation=token;accept.disabled=true;status.textContent='画像を準備しています…';ctx.clearRect(0,0,canvas.width,canvas.height);dialog.showModal();url=URL.createObjectURL(file);
    try{const image=new Image();image.src=url;await image.decode();if(generation!==token)return;const scale=Math.min(1,3600/Math.max(image.naturalWidth,image.naturalHeight),Math.sqrt(8000000/(image.naturalWidth*image.naturalHeight)));source=document.createElement('canvas');source.width=Math.round(image.naturalWidth*scale);source.height=Math.round(image.naturalHeight*scale);source.getContext('2d').drawImage(image,0,0,source.width,source.height);fit();status.textContent='シールの文字部分を指で囲んでください。選択しなければ画像全体を読み取ります。';accept.disabled=false;}catch{if(generation===token){dialog.close();onError('画像を開けませんでした。JPEG・PNG形式の写真でお試しください。');}}
  };
}
