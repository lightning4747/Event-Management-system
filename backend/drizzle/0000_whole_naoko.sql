DO $$ BEGIN
 CREATE TYPE "public"."cert_status" AS ENUM('Pending Upload', 'Uploaded', 'Verified', 'Rejected', 'Deadline Expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."decision" AS ENUM('Approve', 'Reject');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."role" AS ENUM('Student', 'Event Coordinator', 'Mentor', 'Program Coordinator', 'Head of Department', 'Administrator');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."application_status" AS ENUM('In Progress: Event Coordinator', 'In Progress: Mentor', 'In Progress: Program Coordinator', 'In Progress: Head of Department', 'Approved', 'Rejected', 'Withdrawn');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_approval_history" (
	"history_id" bigserial PRIMARY KEY NOT NULL,
	"application_id" bigint NOT NULL,
	"approver_id" varchar(255) NOT NULL,
	"approver_role" "role" NOT NULL,
	"decision" "decision" NOT NULL,
	"comments" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "certificate_deadline_extensions" (
	"extension_id" bigserial PRIMARY KEY NOT NULL,
	"application_id" bigint NOT NULL,
	"extended_by" varchar(255) NOT NULL,
	"new_deadline" date NOT NULL,
	"reason" text NOT NULL,
	"extended_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificate_deadline_extensions_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "certificate_requirements" (
	"requirement_id" bigserial PRIMARY KEY NOT NULL,
	"application_id" bigint NOT NULL,
	"sequence_number" smallint NOT NULL,
	"status" "cert_status" NOT NULL,
	"submission_deadline" date NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_app_id_seq_num" UNIQUE("application_id","sequence_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "certificates" (
	"certificate_id" bigserial PRIMARY KEY NOT NULL,
	"requirement_id" bigint NOT NULL,
	"file_url" text NOT NULL,
	"upload_version" smallint NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_req_id_upload_ver" UNIQUE("requirement_id","upload_version")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "faculty" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"designation" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "od_applications" (
	"application_id" bigserial PRIMARY KEY NOT NULL,
	"student_id" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"location" varchar(255) NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"number_of_events" smallint NOT NULL,
	"status" "application_status" NOT NULL,
	"final_approved_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "students" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"mentor_id" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"date_of_birth" date NOT NULL,
	"admission_year" smallint NOT NULL,
	"section" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "application_approval_history" ADD CONSTRAINT "application_approval_history_application_id_od_applications_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."od_applications"("application_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "application_approval_history" ADD CONSTRAINT "application_approval_history_approver_id_users_user_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "certificate_deadline_extensions" ADD CONSTRAINT "certificate_deadline_extensions_application_id_od_applications_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."od_applications"("application_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "certificate_deadline_extensions" ADD CONSTRAINT "certificate_deadline_extensions_extended_by_faculty_user_id_fk" FOREIGN KEY ("extended_by") REFERENCES "public"."faculty"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "certificate_requirements" ADD CONSTRAINT "certificate_requirements_application_id_od_applications_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."od_applications"("application_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "certificates" ADD CONSTRAINT "certificates_requirement_id_certificate_requirements_requirement_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."certificate_requirements"("requirement_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "faculty" ADD CONSTRAINT "faculty_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "od_applications" ADD CONSTRAINT "od_applications_student_id_students_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "students" ADD CONSTRAINT "students_mentor_id_faculty_user_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."faculty"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_approval_history_app_id_idx" ON "application_approval_history" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_approval_history_approver_id_idx" ON "application_approval_history" USING btree ("approver_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cert_extensions_extended_by_idx" ON "certificate_deadline_extensions" USING btree ("extended_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cert_requirements_app_id_idx" ON "certificate_requirements" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cert_requirements_status_idx" ON "certificate_requirements" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certificates_req_id_idx" ON "certificates" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certificates_is_current_idx" ON "certificates" USING btree ("is_current");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cert_one_current_per_req_idx" ON "certificates" USING btree ("requirement_id") WHERE "certificates"."is_current" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "od_applications_student_id_idx" ON "od_applications" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "od_applications_status_idx" ON "od_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "od_applications_date_range_idx" ON "od_applications" USING btree ("from_date","to_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_mentor_id_idx" ON "students" USING btree ("mentor_id");