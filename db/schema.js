import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', {
 id: text('id').primaryKey(), userId: text('user_id').notNull(), date: text('prescription_date').notNull(), clinic: text('clinic').notNull().default(''), pharmacy: text('pharmacy').notNull().default(''), medicines: text('medicines').notNull(), originalText: text('original_text').notNull().default(''), note: text('note').notNull().default(''), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
}, table => [index('records_user_date').on(table.userId, table.date)]);
