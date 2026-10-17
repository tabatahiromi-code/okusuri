CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`prescription_date` text NOT NULL,
	`clinic` text DEFAULT '' NOT NULL,
	`pharmacy` text DEFAULT '' NOT NULL,
	`medicines` text NOT NULL,
	`original_text` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `records_user_date` ON `records` (`user_id`,`prescription_date`);