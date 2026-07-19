import { db } from '../../db';
import { odApplications, students, applicationApprovalHistory, certificateRequirements, certificates, certificateDeadlineExtensions } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { AppError } from '../../lib/errors';
import { CreateApplicationInput } from './applications.types';

export interface ApplicationDetails {
  applicationId: bigint;
  studentId: string;
  studentName: string;
  mentorId: string;
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
  studentId: string
): Promise<Array<{
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
}>> => {
  return db
    .select()
    .from(odApplications)
    .where(eq(odApplications.studentId, studentId))
    .orderBy(desc(odApplications.createdAt));
};

export const getDepartmentApplications = async (mentorId?: string): Promise<Array<{
  applicationId: bigint;
  studentId: string;
  studentName: string;
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
}>> => {
  const query = db
    .select({
      applicationId: odApplications.applicationId,
      studentId: odApplications.studentId,
      studentName: students.fullName,
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
    .innerJoin(students, eq(odApplications.studentId, students.userId));

  if (mentorId) {
    return query
      .where(eq(students.mentorId, mentorId))
      .orderBy(desc(odApplications.createdAt));
  }

  return query.orderBy(desc(odApplications.createdAt));
};

export const getApplicationDetails = async (
  applicationId: bigint,
  userId: string,
  role: string
): Promise<{
  application: ApplicationDetails;
  history: ApprovalHistoryItem[];
  certificates: CertificateRequirementItem[];
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

  // 2. Enforce authorization filters
  if (role === 'Student' && app.studentId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Access Denied: You do not own this application.');
  }

  if (role === 'Mentor' && app.mentorId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Access Denied: The student is not in your cohort.');
  }

  // 3. Fetch approval history
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

  if (app.status === 'Approved' || app.status === 'Rejected' || app.status == 'Withdrawn') {
    throw new AppError(400, 'APPLICATION_IMMUTABLE', 'This On-Duty application has already been decided and is immutable.');
  }
};
