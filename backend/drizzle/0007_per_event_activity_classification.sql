ALTER TABLE "od_applications" ADD COLUMN IF NOT EXISTS "events" json;
ALTER TABLE "certificate_requirements" ADD COLUMN IF NOT EXISTS "activity_category" "activity_category";
ALTER TABLE "certificate_requirements" ADD COLUMN IF NOT EXISTS "activity_type" varchar(255);
