export function validateRecord(data) {
  if (!data || typeof data.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || Number.isNaN(Date.parse(data.date)) || new Date(data.date).toISOString().slice(0,10) !== data.date) return null;
  const fields = ['clinic', 'pharmacy', 'originalText', 'note'];
  if (fields.some(k => typeof data[k] !== 'string' || data[k].length > (k === 'originalText' ? 30000 : 3000))) return null;
  if (!Array.isArray(data.medicines) || !data.medicines.length || data.medicines.length > 50) return null;
  if (data.medicines.some(m => !m || typeof m.name !== 'string' || !m.name.trim() || m.name.length > 500 || typeof m.dosage !== 'string' || m.dosage.length > 1000)) return null;
  return { date:data.date, clinic:data.clinic, pharmacy:data.pharmacy, originalText:data.originalText, note:data.note, medicines:data.medicines.map(m=>({name:m.name.trim(),dosage:m.dosage.trim()})) };
}
export function parseImport(data) {
  if(!data || data.version!==1 || !Array.isArray(data.records)) throw new Error('version: 1 と records 配列のあるお薬手帳JSONを選択してください。');
  if(!data.records.length || data.records.length>100) throw new Error('一度に取り込める記録は1〜100件です。');
  return data.records.map((record,i)=>{
    // Deliberately ignore incoming IDs, ownership, and extra fields.
    const parsed=validateRecord(record);
    if(!parsed) throw new Error(`${i+1}件目の形式が不正です。処方日、薬名、用法・用量、医療機関、薬局、メモ、原文の項目を確認してください。`);
    return parsed;
  });
}
export const recordFingerprint=record=>JSON.stringify(validateRecord(record));
