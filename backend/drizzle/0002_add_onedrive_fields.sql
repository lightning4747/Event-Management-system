ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "drive_item_id" text;
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "file_name" varchar(255);
