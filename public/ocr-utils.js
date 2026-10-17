// Formatting only: do not guess or substitute drug names, amounts, or doses.
export function normalizeOcrText(text) {
  return text.normalize('NFKC')
    .replace(/(?<=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々\d])[ \t]+(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々\d])/gu, '')
    .replace(/([「『（])[ \t]+/g, '$1').replace(/[ \t]+([」』）])/g, '$1')
    .split(/\r?\n/).map(line => line.trim()).join('\n').trim();
}
export const OCR_MODEL = { language: 'Japanese', langPath: '/ocr/japanese-v2', cachePath: 'okusuri-japanese-script-int-v2' };
export function imageSize(width, height) {
  const scale = Math.min(2, 2400 / Math.max(width, height), Math.sqrt(6000000 / (width * height)));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export function prepareImage(image) {
  const size=imageSize(image.width,image.height);
  const canvas=document.createElement('canvas');canvas.width=size.width+48;canvas.height=size.height+48;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,24,24,size.width,size.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height), histogram=new Uint32Array(256);
  for(let i=0;i<pixels.data.length;i+=4){const gray=Math.round(.299*pixels.data[i]+.587*pixels.data[i+1]+.114*pixels.data[i+2]);histogram[gray]++;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=gray;}
  const count=canvas.width*canvas.height;let sum=0,low=0,high=255;
  for(let n=0;n<256;n++){sum+=histogram[n];if(sum>=count*.01){low=Math.min(n,80);break;}}
  sum=0;for(let n=255;n>=0;n--){sum+=histogram[n];if(sum>=count*.01){high=Math.max(n,180);break;}}
  for(let i=0;i<pixels.data.length;i+=4){const v=Math.max(0,Math.min(255,Math.round((pixels.data[i]-low)*255/(high-low))));pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;}
  ctx.putImageData(pixels,0,0);return canvas;
}
