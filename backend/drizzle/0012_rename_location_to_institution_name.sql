ALTER TABLE "od_applications" RENAME COLUMN "location" TO "institution_name";
ALTER TABLE "od_applications" ALTER COLUMN "institution_name" SET DATA TYPE varchar(100);
