DO $$ BEGIN
  CREATE TYPE "achievement_position" AS ENUM('Participation', 'First Prize', 'Second Prize', 'Third Prize');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "od_applications" ADD COLUMN IF NOT EXISTS "achievement" "achievement_position" DEFAULT 'Participation' NOT NULL;
