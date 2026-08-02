import { pgTable, varchar, text, timestamp, date, smallint, bigint, pgEnum, bigserial, foreignKey, index, boolean, check, unique, uniqueIndex, json } from 'drizzle-orm/pg-core';
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
  'Reject',
  'Withdraw'
]);

export const certStatusEnum = pgEnum('cert_status', [
  'Pending Upload',
  'Uploaded',
  'Verified',
  'Rejected',
  'Deadline Expired',
  'Skipped'
]);

export const activityCategoryEnum = pgEnum('activity_category', [
  'Extracurricular',
  'Co-curricular',
  'Others'
]);

export const achievementEnum = pgEnum('achievement_position', [
  'Participation',
  'First Prize',
  'Second Prize',
  'Third Prize'
]);

// 2. Table Definitions

// USERS Table
export const users = pgTable('users', {
  userId: varchar('user_id', { length: 50 }).primaryKey(),
  username: varchar('username', { length: 100 }).unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull(),
  createdBy: varchar('created_by', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
}, (table) => ({
  createdByFk: foreignKey({
    columns: [table.createdBy],
    foreignColumns: [table.userId]
  }).onDelete('set null')
}));

// FACULTY Table
export const faculty = pgTable('faculty', {
  userId: varchar('user_id', { length: 50 }).primaryKey().references(() => users.userId, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 100 }).notNull(),
  designation: varchar('designation', { length: 100 }).notNull()
});

// STUDENTS Table
export const students = pgTable('students', {
  userId: varchar('user_id', { length: 50 }).primaryKey().references(() => users.userId, { onDelete: 'cascade' }),
  mentorId: varchar('mentor_id', { length: 50 }).references(() => faculty.userId, { onDelete: 'restrict' }).notNull(),
  fullName: varchar('full_name', { length: 100 }).notNull(),
  dateOfBirth: date('date_of_birth', { mode: 'string' }).notNull(),
  admissionYear: smallint('admission_year').notNull(),
  section: varchar('section', { length: 10 }).notNull()
}, (table) => ({
  mentorIdIdx: index('students_mentor_id_idx').on(table.mentorId)
}));

// OD_APPLICATIONS Table
export const odApplications = pgTable('od_applications', {
  applicationId: bigserial('application_id', { mode: 'bigint' }).primaryKey(),
  studentId: varchar('student_id', { length: 50 }).references(() => students.userId, { onDelete: 'restrict' }).notNull(),
  title: varchar('title', { length: 150 }).notNull(),
  activityCategory: activityCategoryEnum('activity_category').default('Co-curricular').notNull(),
  activityType: varchar('activity_type', { length: 100 }).default('General').notNull(),
  achievement: achievementEnum('achievement').default('Participation').notNull(),
  awardName: varchar('award_name', { length: 150 }),
  events: json('events').$type<Array<{
    sequenceNumber: number;
    activityCategory: 'Extracurricular' | 'Co-curricular' | 'Others';
    activityType: string;
    achievement?: 'Participation' | 'First Prize' | 'Second Prize' | 'Third Prize';
    awardName?: string;
  }>>(),
  location: varchar('location', { length: 150 }).notNull(),
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
  studentCreatedAtIdx: index('od_applications_student_created_at_idx').on(table.studentId, table.createdAt),
  fromDateLessToDateCheck: check('from_date_less_to_date_check', sql`${table.fromDate} <= ${table.toDate}`),
  numberOfEventsRangeCheck: check('number_of_events_range_check', sql`${table.numberOfEvents} >= 1 AND ${table.numberOfEvents} <= 4`)
}));

// APPLICATION_APPROVAL_HISTORY Table
export const applicationApprovalHistory = pgTable('application_approval_history', {
  historyId: bigserial('history_id', { mode: 'bigint' }).primaryKey(),
  applicationId: bigint('application_id', { mode: 'bigint' }).references(() => odApplications.applicationId, { onDelete: 'cascade' }).notNull(),
  approverId: varchar('approver_id', { length: 50 }).references(() => users.userId, { onDelete: 'restrict' }).notNull(),
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
  applicationId: bigint('application_id', { mode: 'bigint' }).references(() => odApplications.applicationId, { onDelete: 'cascade' }).notNull(),
  sequenceNumber: smallint('sequence_number').notNull(),
  activityCategory: activityCategoryEnum('activity_category'),
  activityType: varchar('activity_type', { length: 100 }),
  status: certStatusEnum('status').notNull(),
  submissionDeadline: date('submission_deadline', { mode: 'string' }).notNull(),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  applicationIdIdx: index('cert_requirements_application_id_idx').on(table.applicationId),
  statusIdx: index('cert_requirements_status_idx').on(table.status),
  deadlineIdx: index('cert_requirements_deadline_idx').on(table.submissionDeadline),
  sequenceNumberPositiveCheck: check('sequence_number_positive_check', sql`${table.sequenceNumber} > 0`),
  uniqueAppIdSeqNum: unique('unique_app_id_seq_num').on(table.applicationId, table.sequenceNumber)
}));

// CERTIFICATES Table
export const certificates = pgTable('certificates', {
  certificateId: bigserial('certificate_id', { mode: 'bigint' }).primaryKey(),
  requirementId: bigint('requirement_id', { mode: 'bigint' }).references(() => certificateRequirements.requirementId, { onDelete: 'cascade' }).notNull(),
  driveItemId: varchar('drive_item_id', { length: 255 }),
  fileName: varchar('file_name', { length: 200 }),
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

export const extensionStatusEnum = pgEnum('extension_status', [
  'Pending',
  'Approved',
  'Rejected'
]);

// CERTIFICATE_DEADLINE_EXTENSIONS Table
export const certificateDeadlineExtensions = pgTable('certificate_deadline_extensions', {
  extensionId: bigserial('extension_id', { mode: 'bigint' }).primaryKey(),
  applicationId: bigint('application_id', { mode: 'bigint' }).references(() => odApplications.applicationId, { onDelete: 'cascade' }).notNull().unique(),
  studentId: varchar('student_id', { length: 50 }).references(() => students.userId, { onDelete: 'restrict' }).notNull(),
  requestedDays: smallint('requested_days').notNull(),
  newDeadline: date('new_deadline', { mode: 'string' }).notNull(),
  reason: text('reason').notNull(),
  status: extensionStatusEnum('status').default('Pending').notNull(),
  rejectionReason: text('rejection_reason'),
  extendedBy: varchar('extended_by', { length: 50 }).references(() => faculty.userId, { onDelete: 'set null' }),
  requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
  decidedAt: timestamp('decided_at', { withTimezone: true })
}, (table) => ({
  studentIdIdx: index('cert_extensions_student_id_idx').on(table.studentId),
  extendedByIdx: index('cert_extensions_extended_by_idx').on(table.extendedBy)
}));
