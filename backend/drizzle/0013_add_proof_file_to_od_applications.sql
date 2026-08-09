ALTER TABLE "od_applications" ADD COLUMN IF NOT EXISTS "proof_file_url" text;
ALTER TABLE "od_applications" ADD COLUMN IF NOT EXISTS "proof_file_name" varchar(255);
