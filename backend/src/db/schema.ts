import { pgTable, varchar, text, timestamp, date, smallint, bigint, pgEnum, bigserial, foreignKey, index, boolean, check, unique, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

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
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
}, (table) => ({
  createdByFk: foreignKey({
    columns: [table.createdBy],
    foreignColumns: [table.userId]
  })
}));

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
  dateOfBirth: date('date_of_birth', { mode: 'string' }).notNull(),
  admissionYear: smallint('admission_year').notNull(),
  section: varchar('section', { length: 50 }).notNull()
}, (table) => ({
  mentorIdIdx: index('students_mentor_id_idx').on(table.mentorId)
}));

// OD_APPLICATIONS Table
export const odApplications = pgTable('od_applications', {
  applicationId: bigserial('application_id', { mode: 'bigint' }).primaryKey(),
  studentId: varchar('student_id', { length: 255 }).references(() => students.userId).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  location: varchar('location', { length: 255 }).notNull(),
  fromDate: date('from_date', { mode: 'string' }).notNull(),
  toDate: date('to_date', { mode: 'string' }).notNull(),
  numberOfEvents: smallint('number_of_events').notNull(),
  status: statusEnum('status').notNull(),
  finalApprovedAt: timestamp('final_approved_at', { withTimezone: true }),
  withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  studentIdIdx: index('od_applications_student_id_idx').on(table.studentId),
  statusIdx: index('od_applications_status_idx').on(table.status),
  dateRangeIdx: index('od_applications_date_range_idx').on(table.fromDate, table.toDate),
  fromDateLessToDateCheck: check('from_date_less_to_date_check', sql`${table.fromDate} <= ${table.toDate}`),
  numberOfEventsPositiveCheck: check('number_of_events_positive_check', sql`${table.numberOfEvents} > 0`)
}));

// APPLICATION_APPROVAL_HISTORY Table
export const applicationApprovalHistory = pgTable('application_approval_history', {
  historyId: bigserial('history_id', { mode: 'bigint' }).primaryKey(),
  applicationId: bigint('application_id', { mode: 'bigint' }).references(() => odApplications.applicationId).notNull(),
  approverId: varchar('approver_id', { length: 255 }).references(() => users.userId).notNull(),
  approverRole: roleEnum('approver_role').notNull(),
  decision: decisionEnum('decision').notNull(),
  comments: text('comments'),
  decidedAt: timestamp('decided_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  applicationIdIdx: index('app_approval_history_app_id_idx').on(table.applicationId),
  approverIdIdx: index('app_approval_history_approver_id_idx').on(table.approverId)
}));

// CERTIFICATE_REQUIREMENTS Table
export const certificateRequirements = pgTable('certificate_requirements', {
  requirementId: bigserial('requirement_id', { mode: 'bigint' }).primaryKey(),
  applicationId: bigint('application_id', { mode: 'bigint' }).references(() => odApplications.applicationId).notNull(),
  sequenceNumber: smallint('sequence_number').notNull(),
  status: certStatusEnum('status').notNull(),
  submissionDeadline: date('submission_deadline', { mode: 'string' }).notNull(),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  applicationIdIdx: index('cert_requirements_app_id_idx').on(table.applicationId),
  statusIdx: index('cert_requirements_status_idx').on(table.status),
  uniqueAppIdSeqNum: unique('unique_app_id_seq_num').on(table.applicationId, table.sequenceNumber)
}));

// CERTIFICATES Table
export const certificates = pgTable('certificates', {
  certificateId: bigserial('certificate_id', { mode: 'bigint' }).primaryKey(),
  requirementId: bigint('requirement_id', { mode: 'bigint' }).references(() => certificateRequirements.requirementId).notNull(),
  fileUrl: text('file_url').notNull(),
  uploadVersion: smallint('upload_version').notNull(),
  isCurrent: boolean('is_current').default(true).notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  requirementIdIdx: index('certificates_req_id_idx').on(table.requirementId),
  isCurrentIdx: index('certificates_is_current_idx').on(table.isCurrent),
  uniqueReqIdUploadVer: unique('unique_req_id_upload_ver').on(table.requirementId, table.uploadVersion),
  uniqueCurrentCertPerReqIdx: uniqueIndex('cert_one_current_per_req_idx').on(table.requirementId).where(sql`${table.isCurrent} = true`)
}));

// CERTIFICATE_DEADLINE_EXTENSIONS Table
export const certificateDeadlineExtensions = pgTable('certificate_deadline_extensions', {
  extensionId: bigserial('extension_id', { mode: 'bigint' }).primaryKey(),
  applicationId: bigint('application_id', { mode: 'bigint' }).references(() => odApplications.applicationId).notNull().unique(),
  extendedBy: varchar('extended_by', { length: 255 }).references(() => faculty.userId).notNull(),
  newDeadline: date('new_deadline', { mode: 'string' }).notNull(),
  reason: text('reason').notNull(),
  extendedAt: timestamp('extended_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  extendedByIdx: index('cert_extensions_extended_by_idx').on(table.extendedBy)
}));
