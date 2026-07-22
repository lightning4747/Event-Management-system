DO $$ BEGIN
 CREATE TYPE "public"."extension_status" AS ENUM('Pending', 'Approved', 'Rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "certificate_deadline_extensions" ADD COLUMN IF NOT EXISTS "student_id" varchar(255) REFERENCES "students"("user_id");
ALTER TABLE "certificate_deadline_extensions" ADD COLUMN IF NOT EXISTS "requested_days" smallint DEFAULT 7 NOT NULL;
ALTER TABLE "certificate_deadline_extensions" ADD COLUMN IF NOT EXISTS "status" "extension_status" DEFAULT 'Pending' NOT NULL;
ALTER TABLE "certificate_deadline_extensions" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
ALTER TABLE "certificate_deadline_extensions" ADD COLUMN IF NOT EXISTS "requested_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "certificate_deadline_extensions" ADD COLUMN IF NOT EXISTS "decided_at" timestamp with time zone;
ALTER TABLE "certificate_deadline_extensions" ALTER COLUMN "extended_by" DROP NOT NULL;
