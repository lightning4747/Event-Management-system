DO $$ 
BEGIN 
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'od_applications' AND column_name = 'location'
  ) THEN
    ALTER TABLE "od_applications" RENAME COLUMN "location" TO "institution_name";
  END IF;

  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'od_applications' AND column_name = 'institution_name'
  ) THEN
    ALTER TABLE "od_applications" ADD COLUMN "institution_name" varchar(100) NOT NULL DEFAULT '';
  END IF;
END $$;
ALTER TABLE "od_applications" ALTER COLUMN "institution_name" SET DATA TYPE varchar(100);
