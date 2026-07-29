import { db } from '../../db';
import { odApplications, students, users, certificateRequirements, certificateDeadlineExtensions } from '../../db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import { addDays, parseISO, format } from 'date-fns';
import { AppError } from '../../lib/errors';
import { RequestExtensionInput, DecideExtensionInput } from './extensions.types';

export const requestDeadlineExtension = async (
  studentUserId: string,
  input: RequestExtensionInput
): Promise<{ extensionId: bigint; newDeadline: string; requestedDays: number }> => {
  let appId: bigint;
  try {
    appId = BigInt(input.applicationId);
  } catch {
    throw new AppError(400, 'BAD_REQUEST', 'Invalid application ID format.');
  }

  // 1. Fetch application and student details
  const [app] = await db
    .select({
      applicationId: odApplications.applicationId,
      studentId: odApplications.studentId,
      status: odApplications.status,
      toDate: odApplications.toDate,
    })
    .from(odApplications)
    .innerJoin(users, eq(odApplications.studentId, users.userId))
    .where(
      and(
        eq(odApplications.applicationId, appId),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (!app) {
    throw new AppError(404, 'NOT_FOUND', 'On-Duty application not found.');
  }

  // Verify application belongs to authenticated student
  if (app.studentId !== studentUserId) {
    throw new AppError(403, 'FORBIDDEN', 'Access Denied: You do not own this application.');
  }

  // Verify application is approved
  if (app.status !== 'Approved') {
    throw new AppError(400, 'INVALID_APPLICATION_STATUS', 'Deadline extensions can only be requested for approved applications.');
  }

  // 2. Enforce single extension request per application constraint
  const [existingExtension] = await db
    .select()
    .from(certificateDeadlineExtensions)
    .where(eq(certificateDeadlineExtensions.applicationId, appId))
    .limit(1);

  if (existingExtension) {
    let message = 'An extension request has already been submitted for this application.';
    if (existingExtension.status === 'Pending') {
      message = 'An extension request is already pending event coordinator review.';
    } else if (existingExtension.status === 'Approved') {
      message = 'An extension has already been granted for this application.';
    } else if (existingExtension.status === 'Rejected') {
      message = 'An extension request was previously submitted and rejected for this application. Only one extension request is permitted per application.';
    }
    throw new AppError(400, 'EXTENSION_EXISTS', message);
  }

  // 3. Calculate new deadline: default deadline (toDate + 7 days) + requested extension days
  const defaultDeadlineDate = addDays(parseISO(app.toDate), 7);
  const newDeadlineDate = addDays(defaultDeadlineDate, input.requestedDays);
  const newDeadlineStr = format(newDeadlineDate, 'yyyy-MM-dd');

  // 4. Insert extension request
  const [inserted] = await db
    .insert(certificateDeadlineExtensions)
    .values({
      applicationId: appId,
      studentId: studentUserId,
      requestedDays: input.requestedDays,
      newDeadline: newDeadlineStr,
      reason: input.reason,
      status: 'Pending',
    })
    .returning({
      extensionId: certificateDeadlineExtensions.extensionId,
      newDeadline: certificateDeadlineExtensions.newDeadline,
      requestedDays: certificateDeadlineExtensions.requestedDays,
    });

  return inserted;
};

export const decideDeadlineExtension = async (
  ecUserId: string,
  extensionId: bigint,
  input: DecideExtensionInput
): Promise<{ extensionId: bigint; status: 'Approved' | 'Rejected'; newDeadline?: string }> => {
  const result = await db.transaction(async (tx) => {
    const [ext] = await tx
      .select({
        extensionId: certificateDeadlineExtensions.extensionId,
        applicationId: certificateDeadlineExtensions.applicationId,
        studentId: certificateDeadlineExtensions.studentId,
        requestedDays: certificateDeadlineExtensions.requestedDays,
        newDeadline: certificateDeadlineExtensions.newDeadline,
        status: certificateDeadlineExtensions.status,
      })
      .from(certificateDeadlineExtensions)
      .innerJoin(odApplications, eq(certificateDeadlineExtensions.applicationId, odApplications.applicationId))
      .where(eq(certificateDeadlineExtensions.extensionId, extensionId))
      .for('update', { of: certificateDeadlineExtensions })
      .limit(1);

    if (!ext) {
      throw new AppError(404, 'NOT_FOUND', 'Extension request not found.');
    }

    if (ext.status !== 'Pending') {
      throw new AppError(400, 'INVALID_STATUS', 'This extension request has already been decided.');
    }

    if (input.decision === 'Approve') {
      // A. Update extension record
      await tx
        .update(certificateDeadlineExtensions)
        .set({
          status: 'Approved',
          extendedBy: ecUserId,
          decidedAt: new Date(),
        })
        .where(eq(certificateDeadlineExtensions.extensionId, extensionId));

      // B. Update requirements status and deadlines
      await tx
        .update(certificateRequirements)
        .set({
          status: 'Pending Upload',
          submissionDeadline: ext.newDeadline,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(certificateRequirements.applicationId, ext.applicationId),
            or(
              eq(certificateRequirements.status, 'Pending Upload'),
              eq(certificateRequirements.status, 'Deadline Expired')
            )
          )
        );

      return {
        extensionId,
        status: 'Approved' as const,
        newDeadline: ext.newDeadline,
      };
    } else {
      // Rejection
      await tx
        .update(certificateDeadlineExtensions)
        .set({
          status: 'Rejected',
          extendedBy: ecUserId,
          rejectionReason: input.comments || 'Extension request rejected by event coordinator.',
          decidedAt: new Date(),
        })
        .where(eq(certificateDeadlineExtensions.extensionId, extensionId));

      return {
        extensionId,
        status: 'Rejected' as const,
      };
    }
  });

  return result;
};

export const getPendingExtensionsForEC = async () => {
  const pendingRequests = await db
    .select({
      extensionId: certificateDeadlineExtensions.extensionId,
      applicationId: certificateDeadlineExtensions.applicationId,
      studentId: odApplications.studentId,
      studentName: students.fullName,
      title: odApplications.title,
      requestedDays: certificateDeadlineExtensions.requestedDays,
      newDeadline: certificateDeadlineExtensions.newDeadline,
      reason: certificateDeadlineExtensions.reason,
      requestedAt: certificateDeadlineExtensions.requestedAt,
    })
    .from(certificateDeadlineExtensions)
    .innerJoin(odApplications, eq(certificateDeadlineExtensions.applicationId, odApplications.applicationId))
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(eq(certificateDeadlineExtensions.status, 'Pending'));

  return pendingRequests.map((r) => ({
    ...r,
    extensionId: r.extensionId.toString(),
    applicationId: r.applicationId.toString(),
  }));
};
