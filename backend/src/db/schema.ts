import { pgTable, varchar, text, timestamp, date, smallint, bigint, pgEnum, bigserial } from 'drizzle-orm/pg-core';

// 1. Enum Definitions
export const roleEnum = pgEnum('role', [
  'Student',
  'Event Coordinator',
  'Mentor',
  'Program Coordinator',
  'Head of Department',
  'Administrator'
]);

export const statusEnum = pgEnum('application_status', [
  'Draft',
  'In Progress: Event Coordinator',
  'In Progress: Mentor',
  'In Progress: Program Coordinator',
  'In Progress: Head of Department',
  'Approved',
  'Rejected',
  'Withdrawn'
]);

export const decisionEnum = pgEnum('decision', [
  'Approve',
  'Reject'
]);

export const certStatusEnum = pgEnum('cert_status', [
  'Pending Upload',
  'Uploaded',
  'Verified',
  'Rejected',
  'Deadline Expired'
]);

// 2. Table Definitions

// USERS Table
export const users = pgTable('users', {
  userId: varchar('user_id', { length: 255 }).primaryKey(),
  username: varchar('username', { length: 255 }).unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
});

// FACULTY Table
export const faculty = pgTable('faculty', {
  userId: varchar('user_id', { length: 255 }).primaryKey().references(() => users.userId),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  designation: varchar('designation', { length: 255 }).notNull()
});

// STUDENTS Table
export const students = pgTable('students', {
  userId: varchar('user_id', { length: 255 }).primaryKey().references(() => users.userId),
  mentorId: varchar('mentor_id', { length: 255 }).references(() => faculty.userId).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  dateOfBirth: date('date_of_birth').notNull(),
  admissionYear: smallint('admission_year').notNull(),
  section: varchar('section', { length: 50 }).notNull()
});

// OD_APPLICATIONS Table
export const odApplications = pgTable('od_applications', {
  applicationId: bigserial('application_id', { mode: 'number' }).primaryKey(),
  studentId: varchar('student_id', { length: 255 }).references(() => students.userId).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  location: varchar('location', { length: 255 }).notNull(),
  fromDate: date('from_date').notNull(),
  toDate: date('to_date').notNull(),
  numberOfEvents: smallint('number_of_events').notNull(),
  status: statusEnum('status').notNull(),
  finalApprovedAt: timestamp('final_approved_at', { withTimezone: true }),
  withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// APPLICATION_APPROVAL_HISTORY Table
export const applicationApprovalHistory = pgTable('application_approval_history', {
  historyId: bigserial('history_id', { mode: 'number' }).primaryKey(),
  applicationId: bigint('application_id', { mode: 'number' }).references(() => odApplications.applicationId).notNull(),
  approverId: varchar('approver_id', { length: 255 }).references(() => users.userId).notNull(),
  approverRole: roleEnum('approver_role').notNull(),
  decision: decisionEnum('decision').notNull(),
  comments: text('comments'),
  decidedAt: timestamp('decided_at', { withTimezone: true }).defaultNow().notNull()
});

// CERTIFICATE_REQUIREMENTS Table
export const certificateRequirements = pgTable('certificate_requirements', {
  requirementId: bigserial('requirement_id', { mode: 'number' }).primaryKey(),
  applicationId: bigint('application_id', { mode: 'number' }).references(() => odApplications.applicationId).notNull(),
  sequenceNumber: smallint('sequence_number').notNull(),
  status: certStatusEnum('status').notNull(),
  submissionDeadline: date('submission_deadline').notNull(),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// CERTIFICATES Table
export const certificates = pgTable('certificates', {
  certificateId: bigserial('certificate_id', { mode: 'number' }).primaryKey(),
  requirementId: bigint('requirement_id', { mode: 'number' }).references(() => certificateRequirements.requirementId).notNull(),
  filePath: text('file_path').notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// CERTIFICATE_DEADLINE_EXTENSIONS Table
export const certificateDeadlineExtensions = pgTable('certificate_deadline_extensions', {
  extensionId: bigserial('extension_id', { mode: 'number' }).primaryKey(),
  applicationId: bigint('application_id', { mode: 'number' }).references(() => odApplications.applicationId).notNull(),
  extendedBy: varchar('extended_by', { length: 255 }).references(() => faculty.userId).notNull(),
  newDeadline: date('new_deadline').notNull(),
  reason: text('reason').notNull(),
  extendedAt: timestamp('extended_at', { withTimezone: true }).defaultNow().notNull()
});
