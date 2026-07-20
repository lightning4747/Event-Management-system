import { db } from '../../db';
import { odApplications, students, users, applicationApprovalHistory, certificateRequirements, certificates, certificateDeadlineExtensions } from '../../db/schema';
import { eq, desc, or, and, inArray, sql, isNull } from 'drizzle-orm';
import { AppError } from '../../lib/errors';
import { CreateApplicationInput } from './applications.types';

export interface ApplicationRow {
  applicationId: bigint;
  studentId: string;
  title: string;
  location: string;
  fromDate: string;
  toDate: string;
  numberOfEvents: number;
  status: 'In Progress: Event Coordinator' | 'In Progress: Mentor' | 'In Progress: Program Coordinator' | 'In Progress: Head of Department' | 'Approved' | 'Rejected' | 'Withdrawn';
  finalApprovedAt: Date | null;
  withdrawnAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplicationDetails extends ApplicationRow {
  studentName: string;
  mentorId: string;
}

export interface ApprovalHistoryItem {
  historyId: bigint;
  applicationId: bigint;
  approverId: string;
  approverRole: 'Student' | 'Event Coordinator' | 'Mentor' | 'Program Coordinator' | 'Head of Department' | 'Administrator';
  decision: 'Approve' | 'Reject';
  comments: string | null;
  decidedAt: Date;
}

export interface CertificateRequirementItem {
  requirementId: bigint;
  sequenceNumber: number;
  status: 'Pending Upload' | 'Uploaded' | 'Verified' | 'Rejected' | 'Deadline Expired';
  submissionDeadline: string;
  rejectionReason: string | null;
  fileUrl: string | null;
  uploadVersion: number | null;
  isCurrent: boolean | null;
  uploadedAt: Date | null;
}

export const createApplication = async (
  input: CreateApplicationInput,
  studentId: string
): Promise<{ applicationId: bigint; studentId: string; title: string; status: string; createdAt: Date }> => {
  // Verify student exists in students table
  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.userId, studentId))
    .limit(1);

  if (!student) {
    throw new AppError(404, 'NOT_FOUND', 'Student record not found in system.');
  }

  const [insertedApp] = await db
    .insert(odApplications)
    .values({
      studentId,
      title: input.title,
      location: input.location,
      fromDate: input.fromDate,
      toDate: input.toDate,
      numberOfEvents: input.numberOfEvents,
      status: 'In Progress: Event Coordinator',
    })
    .returning({
      applicationId: odApplications.applicationId,
      studentId: odApplications.studentId,
      title: odApplications.title,
      status: odApplications.status,
      createdAt: odApplications.createdAt,
    });

  return insertedApp;
};

export const getStudentApplications = async (
  studentId: string,
  limit?: number,
  offset?: number
): Promise<Array<ApplicationRow>> => {
  return db
    .select()
    .from(odApplications)
    .where(eq(odApplications.studentId, studentId))
    .orderBy(desc(odApplications.createdAt))
    .limit(limit ?? 100)
    .offset(offset ?? 0);
};

const hasApprovedPreviousStage = (approverRole: string) => {
  return sql`EXISTS (
    SELECT 1 FROM application_approval_history 
    WHERE application_approval_history.application_id = ${odApplications.applicationId}
      AND application_approval_history.approver_role = ${approverRole}
      AND application_approval_history.decision = 'Approve'
  )`;
};

export const getDepartmentApplications = async (
  role: string,
  userId: string,
  limit?: number,
  offset?: number
): Promise<Array<ApplicationDetails>> => {
  const query = db
    .select({
      applicationId: odApplications.applicationId,
      studentId: odApplications.studentId,
      studentName: students.fullName,
      mentorId: students.mentorId,
      title: odApplications.title,
      location: odApplications.location,
      fromDate: odApplications.fromDate,
      toDate: odApplications.toDate,
      numberOfEvents: odApplications.numberOfEvents,
      status: odApplications.status,
      finalApprovedAt: odApplications.finalApprovedAt,
      withdrawnAt: odApplications.withdrawnAt,
      createdAt: odApplications.createdAt,
      updatedAt: odApplications.updatedAt,
    })
    .from(odApplications)
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .innerJoin(users, eq(odApplications.studentId, users.userId))
    .limit(limit ?? 100)
    .offset(offset ?? 0);

  if (role === 'Administrator') {
    return query.where(isNull(users.deletedAt)).orderBy(desc(odApplications.createdAt));
  }

  if (role === 'Event Coordinator') {
    return query.where(isNull(users.deletedAt)).orderBy(desc(odApplications.createdAt));
  }

  if (role === 'Mentor') {
    return query
      .where(
        and(
          eq(students.mentorId, userId),
          isNull(users.deletedAt),
          or(
            inArray(odApplications.status, [
              'In Progress: Mentor',
              'In Progress: Program Coordinator',
              'In Progress: Head of Department',
              'Approved'
            ]),
            hasApprovedPreviousStage('Event Coordinator')
          )
        )
      )
      .orderBy(desc(odApplications.createdAt));
  }

  if (role === 'Program Coordinator') {
    return query
      .where(
        and(
          isNull(users.deletedAt),
          or(
            inArray(odApplications.status, [
              'In Progress: Program Coordinator',
              'In Progress: Head of Department',
              'Approved'
            ]),
            hasApprovedPreviousStage('Mentor')
          )
        )
      )
      .orderBy(desc(odApplications.createdAt));
  }

  if (role === 'Head of Department') {
    return query
      .where(
        and(
          isNull(users.deletedAt),
          or(
            inArray(odApplications.status, [
              'In Progress: Head of Department',
              'Approved'
            ]),
            hasApprovedPreviousStage('Program Coordinator')
          )
        )
      )
      .orderBy(desc(odApplications.createdAt));
  }

  return [];
};

export const getApplicationDetails = async (
  applicationId: bigint,
  userId: string,
  role: string
): Promise<{
  application: ApplicationDetails;
  history: ApprovalHistoryItem[];
  certificates: CertificateRequirementItem[];
  extension?: { extensionId: string; newDeadline: string; reason: string } | null;
}> => {
  // 1. Fetch application details
  const [app] = await db
    .select({
      applicationId: odApplications.applicationId,
      studentId: odApplications.studentId,
      studentName: students.fullName,
      mentorId: students.mentorId,
      title: odApplications.title,
      location: odApplications.location,
      fromDate: odApplications.fromDate,
      toDate: odApplications.toDate,
      numberOfEvents: odApplications.numberOfEvents,
      status: odApplications.status,
      finalApprovedAt: odApplications.finalApprovedAt,
      withdrawnAt: odApplications.withdrawnAt,
      createdAt: odApplications.createdAt,
      updatedAt: odApplications.updatedAt,
    })
    .from(odApplications)
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(eq(odApplications.applicationId, applicationId))
    .limit(1);

  if (!app) {
    throw new AppError(404, 'NOT_FOUND', 'On-Duty application not found.');
  }

  // 2. Fetch approval history first to enforce stage validation checks
  const history = await db
    .select({
      historyId: applicationApprovalHistory.historyId,
      applicationId: applicationApprovalHistory.applicationId,
      approverId: applicationApprovalHistory.approverId,
      approverRole: applicationApprovalHistory.approverRole,
      decision: applicationApprovalHistory.decision,
      comments: applicationApprovalHistory.comments,
      decidedAt: applicationApprovalHistory.decidedAt,
    })
    .from(applicationApprovalHistory)
    .where(eq(applicationApprovalHistory.applicationId, applicationId))
    .orderBy(applicationApprovalHistory.decidedAt);

  // 3. Enforce authorization filters
  if (role === 'Student' && app.studentId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Access Denied: You do not own this application.');
  }

  if (role === 'Mentor') {
    if (app.mentorId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Access Denied: The student is not in your cohort.');
    }
    const isVisible =
      ['In Progress: Mentor', 'In Progress: Program Coordinator', 'In Progress: Head of Department', 'Approved'].includes(app.status) ||
      history.some((h) => h.approverRole === 'Event Coordinator' && h.decision === 'Approve');
    if (!isVisible) {
      throw new AppError(403, 'FORBIDDEN', 'Access Denied: This application has not reached your stage yet.');
    }
  }

  if (role === 'Program Coordinator') {
    const isVisible =
      ['In Progress: Program Coordinator', 'In Progress: Head of Department', 'Approved'].includes(app.status) ||
      history.some((h) => h.approverRole === 'Mentor' && h.decision === 'Approve');
    if (!isVisible) {
      throw new AppError(403, 'FORBIDDEN', 'Access Denied: This application has not reached your stage yet.');
    }
  }

  if (role === 'Head of Department') {
    const isVisible =
      ['In Progress: Head of Department', 'Approved'].includes(app.status) ||
      history.some((h) => h.approverRole === 'Program Coordinator' && h.decision === 'Approve');
    if (!isVisible) {
      throw new AppError(403, 'FORBIDDEN', 'Access Denied: This application has not reached your stage yet.');
    }
  }

  // 4. Fetch certificate requirements and matching uploads
  const certs = await db
    .select({
      requirementId: certificateRequirements.requirementId,
      sequenceNumber: certificateRequirements.sequenceNumber,
      status: certificateRequirements.status,
      submissionDeadline: certificateRequirements.submissionDeadline,
      rejectionReason: certificateRequirements.rejectionReason,
      fileUrl: certificates.fileUrl,
      uploadVersion: certificates.uploadVersion,
      isCurrent: certificates.isCurrent,
      uploadedAt: certificates.uploadedAt,
    })
    .from(certificateRequirements)
    .leftJoin(certificates, eq(certificateRequirements.requirementId, certificates.requirementId))
    .where(eq(certificateRequirements.applicationId, applicationId));

  const [ext] = await db
    .select({
      extensionId: certificateDeadlineExtensions.extensionId,
      newDeadline: certificateDeadlineExtensions.newDeadline,
      reason: certificateDeadlineExtensions.reason,
    })
    .from(certificateDeadlineExtensions)
    .where(eq(certificateDeadlineExtensions.applicationId, applicationId))
    .limit(1);

  return {
    application: app,
    history,
    certificates: certs,
    extension: ext ? { ...ext, extensionId: ext.extensionId.toString() } : null,
  };
};

export const checkApplicationImmutability = async (applicationId: bigint): Promise<void> => {
  const [app] = await db
    .select({
      status: odApplications.status,
    })
    .from(odApplications)
    .where(eq(odApplications.applicationId, applicationId))
    .limit(1);

  if (!app) {
    throw new AppError(404, 'NOT_FOUND', 'On-Duty application not found.');
  }

  if (app.status === 'Approved' || app.status === 'Rejected' || app.status === 'Withdrawn') {
    throw new AppError(400, 'APPLICATION_IMMUTABLE', 'This On-Duty application has already been decided and is immutable.');
  }
};

export const withdrawApplication = async (
  applicationId: bigint,
  userId: string
): Promise<{ newStatus: string }> => {
  const result = await db.transaction(async (tx) => {
    const [app] = await tx
      .select({
        status: odApplications.status,
        studentId: odApplications.studentId,
      })
      .from(odApplications)
      .innerJoin(students, eq(odApplications.studentId, students.userId))
      .innerJoin(users, eq(odApplications.studentId, users.userId))
      .where(
        and(
          eq(odApplications.applicationId, applicationId),
          isNull(users.deletedAt)
        )
      )
      .for('update', { of: odApplications })
      .limit(1);

    if (!app) {
      throw new AppError(404, 'NOT_FOUND', 'On-Duty application not found.');
    }

    if (app.studentId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Access Denied: You do not own this application.');
    }

    if (app.status === 'Approved' || app.status === 'Rejected' || app.status === 'Withdrawn') {
      throw new AppError(400, 'APPLICATION_IMMUTABLE', 'This application is already decided and cannot be withdrawn.');
    }

    await tx
      .update(odApplications)
      .set({
        status: 'Withdrawn',
        withdrawnAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(odApplications.applicationId, applicationId));

    return { newStatus: 'Withdrawn' };
  });

  return result;
};

