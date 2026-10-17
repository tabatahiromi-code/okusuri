// Call only with validated records and the identity supplied by Sites.
export async function importRecords(db, user, items) {
  const now=new Date().toISOString();
  const statements=items.map(r=>{
    const values=[user,r.date,r.clinic,r.pharmacy,JSON.stringify(r.medicines),r.originalText,r.note];
    return db.prepare('INSERT INTO records (id,user_id,prescription_date,clinic,pharmacy,medicines,original_text,note,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM records WHERE user_id=? AND prescription_date=? AND clinic=? AND pharmacy=? AND medicines=? AND original_text=? AND note=?)').bind(crypto.randomUUID(),...values,now,now,...values);
  });
  const results=await db.batch(statements);
  const imported=results.reduce((sum,r)=>sum+(r.meta.changes||0),0);
  return {imported,skipped:items.length-imported};
}
