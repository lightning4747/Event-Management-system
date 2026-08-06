import { db } from '../../db';
import { odApplications, students, users, applicationApprovalHistory, certificateRequirements, certificates, certificateDeadlineExtensions } from '../../db/schema';
import { eq, desc, or, and, inArray, sql, isNull } from 'drizzle-orm';
import { AppError } from '../../lib/errors';
import { CreateApplicationInput, EventTag, isAchievementEligible, AchievementPosition } from './applications.types';
import { storageService } from '../../services/storage/storage.service';
import { logger } from '../../utils/logger';

export interface ApplicationRow {
  applicationId: bigint;
  studentId: string;
  title: string;
  activityCategory: 'Extracurricular' | 'Co-curricular' | 'Others';
  activityType: string;
  achievement: AchievementPosition;
  events?: Array<{
    sequenceNumber: number;
    activityCategory: 'Extracurricular' | 'Co-curricular' | 'Others';
    activityType: string;
    achievement?: AchievementPosition;
  }> | null;
  institutionName: string;
  fromDate: string;
  toDate: string;
  numberOfEvents: number;
  proofFileUrl?: string | null;
  proofFileName?: string | null;
  status: 'In Progress: Event Coordinator' | 'In Progress: Mentor' | 'In Progress: Program Coordinator' | 'In Progress: Head of Department' | 'Approved' | 'Rejected' | 'Withdrawn';
  eventTag?: EventTag;
  finalApprovedAt: Date | null;
  withdrawnAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplicationDetails extends ApplicationRow {
  studentName: string;
  mentorId: string;
  eventTag?: EventTag;
}

export interface ApprovalHistoryItem {
  historyId: bigint;
  applicationId: bigint;
  approverId: string;
  approverRole: 'Student' | 'Event Coordinator' | 'Mentor' | 'Program Coordinator' | 'Head of Department' | 'Administrator';
  decision: 'Approve' | 'Reject' | 'Withdraw';
  comments: string | null;
  decidedAt: Date;
}

export interface CertificateRequirementItem {
  requirementId: bigint;
  sequenceNumber: number;
  activityCategory: 'Extracurricular' | 'Co-curricular' | 'Others' | null;
  activityType: string | null;
  status: 'Pending Upload' | 'Uploaded' | 'Verified' | 'Rejected' | 'Deadline Expired' | 'Skipped';
  submissionDeadline: string;
  rejectionReason: string | null;
  fileUrl: string | null;
  uploadVersion: number | null;
  isCurrent: boolean | null;
  uploadedAt: Date | null;
}

export const computeEventTag = (
  fromDate: string,
  toDate: string,
  status: string,
  certs: Array<{ status: string }> = []
): EventTag | undefined => {
  if (status !== 'Approved') {
    return undefined;
  }

  if (certs.length > 0) {
    const hasUploaded = certs.some((c) => c.status === 'Uploaded');
    if (hasUploaded) return 'Reviewing';

    const allVerifiedOrSkipped = certs.every((c) => c.status === 'Verified' || c.status === 'Skipped');
    if (allVerifiedOrSkipped) return 'Completed';
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;

  if (today < fromDate) {
    return 'Upcoming';
  }

  if (today >= fromDate && today <= toDate) {
    return 'Ongoing';
  }

  return certs.length > 0 ? 'Action Required' : 'Completed';
};

export const createApplication = async (
  input: CreateApplicationInput,
  studentId: string
): Promise<{
  applicationId: bigint;
  studentId: string;
  title: string;
  activityCategory: 'Extracurricular' | 'Co-curricular' | 'Others';
  activityType: string;
  achievement: AchievementPosition;
  status: string;
  createdAt: Date;
}> => {
  // Verify student exists in students table
  const [student] = await db
    .select()
    .from(students)
    .innerJoin(users, eq(students.userId, users.userId))
    .where(
      and(
        eq(students.userId, studentId),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (!student) {
    throw new AppError(404, 'NOT_FOUND', 'Student record not found in system.');
  }

  if (input.numberOfEvents < 1 || input.numberOfEvents > 4) {
    throw new AppError(400, 'BAD_REQUEST', 'Number of events must be between 1 and 4.');
  }

  const currentDateStr = new Date().toISOString().split('T')[0];

  if (input.fromDate < currentDateStr) {
    throw new AppError(400, 'BAD_REQUEST', 'Event start date cannot be in the past.');
  }

  if (input.toDate < input.fromDate) {
    throw new AppError(400, 'BAD_REQUEST', 'Event end date must be greater than or equal to the start date.');
  }

  if (input.events && input.events.length !== input.numberOfEvents) {
    throw new AppError(400, 'BAD_REQUEST', `Events array length (${input.events.length}) must match Number of Events (${input.numberOfEvents}).`);
  }

  const primaryCategory = input.events?.[0]?.activityCategory || input.activityCategory || 'Co-curricular';
  const primaryType = input.events?.[0]?.activityType || input.activityType || 'General';

  const defaultEvents = Array.from({ length: input.numberOfEvents }).map((_, idx) => ({
    sequenceNumber: idx + 1,
    activityCategory: primaryCategory,
    activityType: primaryType,
    achievement: (isAchievementEligible(primaryCategory, primaryType) && input.achievement ? input.achievement : 'Participation') as AchievementPosition,
  }));

  const rawEvents = input.events && input.events.length === input.numberOfEvents ? input.events : defaultEvents;

  const eventsToSave = rawEvents.map((evt) => {
    const isEligible = isAchievementEligible(evt.activityCategory, evt.activityType);
    return {
      ...evt,
      achievement: (isEligible && evt.achievement ? evt.achievement : 'Participation') as AchievementPosition,
    };
  });

  const primaryAchievement = (isAchievementEligible(primaryCategory, primaryType)
    ? (eventsToSave[0]?.achievement || input.achievement || 'Participation')
    : 'Participation') as AchievementPosition;

  return await db.transaction(async (tx) => {
    // Acquire transactional advisory lock for this student to prevent race conditions
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('od_app_' || ${studentId}))`);

    // SARGABLE index-friendly daily application count check
    const [countRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(odApplications)
      .where(
        and(
          eq(odApplications.studentId, studentId),
          sql`${odApplications.createdAt} >= CURRENT_DATE AND ${odApplications.createdAt} < CURRENT_DATE + INTERVAL '1 day'`
        )
      );

    if (countRow && Number(countRow.count) >= 3) {
      throw new AppError(400, 'DAILY_LIMIT_EXCEEDED', 'Daily application limit reached. You can create a maximum of 3 applications per day.');
    }

    const [insertedApp] = await tx
      .insert(odApplications)
      .values({
        studentId,
        title: input.title,
        activityCategory: primaryCategory,
        activityType: primaryType,
        achievement: primaryAchievement,
        events: eventsToSave,
        institutionName: input.institutionName,
        fromDate: input.fromDate,
        toDate: input.toDate,
        numberOfEvents: input.numberOfEvents,
        proofFileUrl: input.proofFileUrl || null,
        proofFileName: input.proofFileName || null,
        status: 'In Progress: Event Coordinator',
      })
      .returning({
        applicationId: odApplications.applicationId,
        studentId: odApplications.studentId,
        title: odApplications.title,
        activityCategory: odApplications.activityCategory,
        activityType: odApplications.activityType,
        achievement: odApplications.achievement,
        events: odApplications.events,
        proofFileUrl: odApplications.proofFileUrl,
        proofFileName: odApplications.proofFileName,
        status: odApplications.status,
        createdAt: odApplications.createdAt,
      });

    return insertedApp;
  });
};

/**
 * Attach proof file details to an existing application row.
 * Called after upload so we have the real applicationId for key construction.
 */
export const updateProofUrl = async (
  applicationId: bigint,
  proofFileUrl: string,
  proofFileName: string
): Promise<void> => {
  await db
    .update(odApplications)
    .set({ proofFileUrl, proofFileName })
    .where(eq(odApplications.applicationId, applicationId));
};



export const getStudentApplications = async (
  studentId: string,
  limit?: number,
  offset?: number
): Promise<Array<ApplicationRow>> => {
  const apps = await db
    .select()
    .from(odApplications)
    .where(eq(odApplications.studentId, studentId))
    .orderBy(desc(odApplications.createdAt))
    .limit(limit ?? 100)
    .offset(offset ?? 0);

  const appIds = apps.map((a) => a.applicationId);
  const certMap: Record<string, Array<{ status: string }>> = {};

  if (appIds.length > 0) {
    const allCerts = await db
      .select({
        applicationId: certificateRequirements.applicationId,
        status: certificateRequirements.status,
      })
      .from(certificateRequirements)
      .where(inArray(certificateRequirements.applicationId, appIds));

    for (const c of allCerts) {
      const key = c.applicationId.toString();
      if (!certMap[key]) certMap[key] = [];
      certMap[key].push(c);
    }
  }

  return apps.map((app) => ({
    ...app,
    eventTag: computeEventTag(app.fromDate, app.toDate, app.status, certMap[app.applicationId.toString()] || []),
  }));
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
): Promise<Array<ApplicationRow>> => {
  const query = db
    .select({
      applicationId: odApplications.applicationId,
      studentId: odApplications.studentId,
      studentName: students.fullName,
      mentorId: students.mentorId,
      title: odApplications.title,
      activityCategory: odApplications.activityCategory,
      activityType: odApplications.activityType,
      achievement: odApplications.achievement,
      events: odApplications.events,
      institutionName: odApplications.institutionName,
      fromDate: odApplications.fromDate,
      toDate: odApplications.toDate,
      numberOfEvents: odApplications.numberOfEvents,
      proofFileUrl: odApplications.proofFileUrl,
      proofFileName: odApplications.proofFileName,
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

  let apps: Array<{
    applicationId: bigint;
    studentId: string;
    studentName: string;
    mentorId: string;
    title: string;
    activityCategory: 'Extracurricular' | 'Co-curricular' | 'Others';
    activityType: string;
    achievement: AchievementPosition;
    events?: Array<{
      sequenceNumber: number;
      activityCategory: 'Extracurricular' | 'Co-curricular' | 'Others';
      activityType: string;
      achievement?: AchievementPosition;
    }> | null;
    institutionName: string;
    fromDate: string;
    toDate: string;
    numberOfEvents: number;
    status: string;
    finalApprovedAt: Date | null;
    withdrawnAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  const whereConditions = [isNull(users.deletedAt)];

  if (role === 'Mentor') {
    whereConditions.push(
      eq(students.mentorId, userId),
      or(
        inArray(odApplications.status, [
          'In Progress: Mentor',
          'In Progress: Program Coordinator',
          'In Progress: Head of Department',
          'Approved'
        ]),
        hasApprovedPreviousStage('Event Coordinator')
      )!
    );
  } else if (role === 'Program Coordinator') {
    whereConditions.push(
      or(
        inArray(odApplications.status, [
          'In Progress: Program Coordinator',
          'In Progress: Head of Department',
          'Approved'
        ]),
        hasApprovedPreviousStage('Mentor')
      )!
    );
  } else if (role === 'Head of Department') {
    whereConditions.push(
      or(
        inArray(odApplications.status, [
          'In Progress: Head of Department',
          'Approved'
        ]),
        hasApprovedPreviousStage('Program Coordinator')
      )!
    );
  }

  apps = await query
    .where(and(...whereConditions))
    .orderBy(desc(odApplications.createdAt));

  const appIds = apps.map((a) => a.applicationId);
  const certMap: Record<string, Array<{ status: string }>> = {};

  if (appIds.length > 0) {
    const allCerts = await db
      .select({
        applicationId: certificateRequirements.applicationId,
        status: certificateRequirements.status,
      })
      .from(certificateRequirements)
      .where(inArray(certificateRequirements.applicationId, appIds));

    for (const c of allCerts) {
      const key = c.applicationId.toString();
      if (!certMap[key]) certMap[key] = [];
      certMap[key].push(c);
    }
  }

  return apps.map((app) => ({
    ...app,
    status: app.status as ApplicationRow['status'],
    eventTag: computeEventTag(app.fromDate, app.toDate, app.status, certMap[app.applicationId.toString()] || []),
  }));
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
      activityCategory: odApplications.activityCategory,
      activityType: odApplications.activityType,
      achievement: odApplications.achievement,
      events: odApplications.events,
      institutionName: odApplications.institutionName,
      fromDate: odApplications.fromDate,
      toDate: odApplications.toDate,
      numberOfEvents: odApplications.numberOfEvents,
      proofFileUrl: odApplications.proofFileUrl,
      proofFileName: odApplications.proofFileName,
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
      activityCategory: certificateRequirements.activityCategory,
      activityType: certificateRequirements.activityType,
      status: certificateRequirements.status,
      submissionDeadline: certificateRequirements.submissionDeadline,
      rejectionReason: certificateRequirements.rejectionReason,
      fileUrl: certificates.fileUrl,
      uploadVersion: certificates.uploadVersion,
      isCurrent: certificates.isCurrent,
      uploadedAt: certificates.uploadedAt,
    })
    .from(certificateRequirements)
    .leftJoin(
      certificates,
      and(
        eq(certificateRequirements.requirementId, certificates.requirementId),
        eq(certificates.isCurrent, true)
      )
    )
    .where(eq(certificateRequirements.applicationId, applicationId));

  const [ext] = await db
    .select({
      extensionId: certificateDeadlineExtensions.extensionId,
      newDeadline: certificateDeadlineExtensions.newDeadline,
      requestedDays: certificateDeadlineExtensions.requestedDays,
      reason: certificateDeadlineExtensions.reason,
      status: certificateDeadlineExtensions.status,
      rejectionReason: certificateDeadlineExtensions.rejectionReason,
    })
    .from(certificateDeadlineExtensions)
    .where(eq(certificateDeadlineExtensions.applicationId, applicationId))
    .limit(1);

  const eventTag = computeEventTag(app.fromDate, app.toDate, app.status, certs);

  return {
    application: {
      ...app,
      eventTag,
    },
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
        proofFileUrl: odApplications.proofFileUrl,
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

    // Insert approval log record
    await tx.insert(applicationApprovalHistory).values({
      applicationId,
      approverId: userId,
      approverRole: 'Student',
      decision: 'Withdraw',
      comments: 'Withdrawn by student',
    });

    // Clean up proof from storage — best-effort, does not affect the withdraw outcome
    if (app.proofFileUrl) {
      const proofKey = decodeURIComponent(app.proofFileUrl.replace('/api/files/', ''));
      await storageService.deleteFile(proofKey).catch((e: unknown) =>
        logger.warn({ proofKey, err: (e as Error)?.message }, 'Failed to delete proof on withdraw')
      );
    }

    return { newStatus: 'Withdrawn' };
  });

  return result;
};

