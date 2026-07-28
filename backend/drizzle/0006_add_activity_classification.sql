DO $$ BEGIN
 CREATE TYPE "public"."activity_category" AS ENUM('Extracurricular', 'Co-curricular', 'Others');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "od_applications" ADD COLUMN IF NOT EXISTS "activity_category" "activity_category" DEFAULT 'Co-curricular' NOT NULL;
ALTER TABLE "od_applications" ADD COLUMN IF NOT EXISTS "activity_type" varchar(255) DEFAULT 'General' NOT NULL;
