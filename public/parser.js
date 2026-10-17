import { normalizeOcrText } from './ocr-utils.js';
// OCR結果は候補のみ。自動確定せず、必ずユーザーが原文と確認する。
export function parseSticker(text) {
  const normalized = normalizeOcrText(text);
  const lines = normalized.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  let date = '';
  const d = normalized.match(/(?:(20\d{2})|令和\s*(元|\d{1,2}))\s*[年/.\-]\s*(\d{1,2})\s*[月/.\-]\s*(\d{1,2})/);
  if (d) {
    const year = d[1] ? Number(d[1]) : 2018 + (d[2] === '元' ? 1 : Number(d[2]));
    const candidate = `${year}-${d[3].padStart(2,'0')}-${d[4].padStart(2,'0')}`;
    if (!Number.isNaN(Date.parse(candidate)) && new Date(candidate).toISOString().slice(0,10) === candidate) date = candidate;
  }
  const medicines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/(?:錠|カプセル|散|顆粒|シロップ|軟膏|クリーム|点眼|点鼻|テープ|吸入|坐剤)/.test(line) && !/^(?:1日|1回|用法|用量|毎食|朝|昼|夕|就寝|服用|内服|外用)/.test(line)) {
      medicines.push({name: line, dosage: lines[i+1] && /(?:1日|1回|食後|食前|食間|就寝|頓服|服用)/.test(lines[i+1]) ? lines[i+1] : ''});
    }
  }
  return { date, clinic: lines.find(l=>/(病院|医院|クリニック|診療所)/.test(l)) || '', pharmacy: lines.find(l=>/薬局/.test(l)) || '', medicines: medicines.slice(0,50) };
}
