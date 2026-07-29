-- Schema Refinements: Varchar Lengths & Explicit Foreign Key ON DELETE Constraints

-- USERS Table
ALTER TABLE "users" ALTER COLUMN "user_id" SET DATA TYPE varchar(50);
ALTER TABLE "users" ALTER COLUMN "username" SET DATA TYPE varchar(100);
ALTER TABLE "users" ALTER COLUMN "created_by" SET DATA TYPE varchar(50);

-- FACULTY Table
ALTER TABLE "faculty" DROP CONSTRAINT IF EXISTS "faculty_user_id_users_user_id_fk";
ALTER TABLE "faculty" ALTER COLUMN "user_id" SET DATA TYPE varchar(50);
ALTER TABLE "faculty" ALTER COLUMN "full_name" SET DATA TYPE varchar(100);
ALTER TABLE "faculty" ALTER COLUMN "designation" SET DATA TYPE varchar(100);
ALTER TABLE "faculty" ADD CONSTRAINT "faculty_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE;

-- STUDENTS Table
ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_user_id_users_user_id_fk";
ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_mentor_id_faculty_user_id_fk";
ALTER TABLE "students" ALTER COLUMN "user_id" SET DATA TYPE varchar(50);
ALTER TABLE "students" ALTER COLUMN "mentor_id" SET DATA TYPE varchar(50);
ALTER TABLE "students" ALTER COLUMN "full_name" SET DATA TYPE varchar(100);
ALTER TABLE "students" ALTER COLUMN "section" SET DATA TYPE varchar(10);
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE;
ALTER TABLE "students" ADD CONSTRAINT "students_mentor_id_faculty_user_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "faculty"("user_id") ON DELETE RESTRICT;

-- OD_APPLICATIONS Table
ALTER TABLE "od_applications" DROP CONSTRAINT IF EXISTS "od_applications_student_id_students_user_id_fk";
ALTER TABLE "od_applications" ALTER COLUMN "student_id" SET DATA TYPE varchar(50);
ALTER TABLE "od_applications" ALTER COLUMN "title" SET DATA TYPE varchar(150);
ALTER TABLE "od_applications" ALTER COLUMN "activity_type" SET DATA TYPE varchar(100);
ALTER TABLE "od_applications" ALTER COLUMN "location" SET DATA TYPE varchar(150);
ALTER TABLE "od_applications" ADD CONSTRAINT "od_applications_student_id_students_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "students"("user_id") ON DELETE RESTRICT;

-- APPLICATION_APPROVAL_HISTORY Table
ALTER TABLE "application_approval_history" DROP CONSTRAINT IF EXISTS "application_approval_history_application_id_od_applications_application_id_fk";
ALTER TABLE "application_approval_history" DROP CONSTRAINT IF EXISTS "application_approval_history_approver_id_users_user_id_fk";
ALTER TABLE "application_approval_history" ALTER COLUMN "approver_id" SET DATA TYPE varchar(50);
ALTER TABLE "application_approval_history" ADD CONSTRAINT "application_approval_history_application_id_od_applications_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "od_applications"("application_id") ON DELETE CASCADE;
ALTER TABLE "application_approval_history" ADD CONSTRAINT "application_approval_history_approver_id_users_user_id_fk" FOREIGN KEY ("approver_id") REFERENCES "users"("user_id") ON DELETE RESTRICT;

-- CERTIFICATE_REQUIREMENTS Table
ALTER TABLE "certificate_requirements" DROP CONSTRAINT IF EXISTS "certificate_requirements_application_id_od_applications_application_id_fk";
ALTER TABLE "certificate_requirements" ALTER COLUMN "activity_type" SET DATA TYPE varchar(100);
ALTER TABLE "certificate_requirements" ADD CONSTRAINT "certificate_requirements_application_id_od_applications_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "od_applications"("application_id") ON DELETE CASCADE;

-- CERTIFICATES Table
ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "certificates_requirement_id_certificate_requirements_requirement_id_fk";
ALTER TABLE "certificates" ALTER COLUMN "drive_item_id" SET DATA TYPE varchar(255);
ALTER TABLE "certificates" ALTER COLUMN "file_name" SET DATA TYPE varchar(200);
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_requirement_id_certificate_requirements_requirement_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "certificate_requirements"("requirement_id") ON DELETE CASCADE;

-- CERTIFICATE_DEADLINE_EXTENSIONS Table
ALTER TABLE "certificate_deadline_extensions" DROP CONSTRAINT IF EXISTS "certificate_deadline_extensions_application_id_od_applications_application_id_fk";
ALTER TABLE "certificate_deadline_extensions" DROP CONSTRAINT IF EXISTS "certificate_deadline_extensions_student_id_students_user_id_fk";
ALTER TABLE "certificate_deadline_extensions" DROP CONSTRAINT IF EXISTS "certificate_deadline_extensions_extended_by_faculty_user_id_fk";
ALTER TABLE "certificate_deadline_extensions" ALTER COLUMN "student_id" SET DATA TYPE varchar(50);
ALTER TABLE "certificate_deadline_extensions" ALTER COLUMN "extended_by" SET DATA TYPE varchar(50);
ALTER TABLE "certificate_deadline_extensions" ADD CONSTRAINT "certificate_deadline_extensions_application_id_od_applications_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "od_applications"("application_id") ON DELETE CASCADE;
ALTER TABLE "certificate_deadline_extensions" ADD CONSTRAINT "certificate_deadline_extensions_student_id_students_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "students"("user_id") ON DELETE RESTRICT;
ALTER TABLE "certificate_deadline_extensions" ADD CONSTRAINT "certificate_deadline_extensions_extended_by_faculty_user_id_fk" FOREIGN KEY ("extended_by") REFERENCES "faculty"("user_id") ON DELETE SET NULL;
