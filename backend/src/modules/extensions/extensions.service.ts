import { db } from '../../db';
import { odApplications, students, certificateRequirements, certificateDeadlineExtensions } from '../../db/schema';
import { eq, and, or } from 'drizzle-orm';
import { AppError } from '../../lib/errors';
import { CreateExtensionInput } from './extensions.types';

export const createDeadlineExtension = async (
  mentorUserId: string,
  input: CreateExtensionInput
): Promise<{ extensionId: bigint; newDeadline: string }> => {
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
      mentorId: students.mentorId,
      status: odApplications.status,
    })
    .from(odApplications)
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(eq(odApplications.applicationId, appId))
    .limit(1);

  if (!app) {
    throw new AppError(404, 'NOT_FOUND', 'On-Duty application not found.');
  }

  // Verify application is approved
  if (app.status !== 'Approved') {
    throw new AppError(400, 'INVALID_APPLICATION_STATUS', 'Deadline extensions can only be granted for approved applications.');
  }

  // 2. Cohort Verification (Task 8.1)
  if (app.mentorId !== mentorUserId) {
    throw new AppError(403, 'FORBIDDEN', 'Access Denied: You can only grant extensions to students in your cohort.');
  }

  // 3. Enforce Single Extension Constraint (Task 8.2)
  const [existingExtension] = await db
    .select()
    .from(certificateDeadlineExtensions)
    .where(eq(certificateDeadlineExtensions.applicationId, appId))
    .limit(1);

  if (existingExtension) {
    throw new AppError(400, 'EXTENSION_ALREADY_GRANTED', 'An extension has already been granted for this application.');
  }

  // 4. Verify new deadline is in the future
  const currentDateStr = new Date().toISOString().split('T')[0];
  if (input.newDeadline <= currentDateStr) {
    throw new AppError(400, 'INVALID_DEADLINE', 'The new deadline must be a future date.');
  }

  // 5. Execute transaction (Task 8.3)
  const insertedExtension = await db.transaction(async (tx) => {
    // A. Insert extension log
    const [inserted] = await tx
      .insert(certificateDeadlineExtensions)
      .values({
        applicationId: appId,
        extendedBy: mentorUserId,
        newDeadline: input.newDeadline,
        reason: input.reason,
      })
      .returning({
        extensionId: certificateDeadlineExtensions.extensionId,
        newDeadline: certificateDeadlineExtensions.newDeadline,
      });

    // B. Update requirements status and deadlines
    await tx
      .update(certificateRequirements)
      .set({
        status: 'Pending Upload',
        submissionDeadline: input.newDeadline,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(certificateRequirements.applicationId, appId),
          or(
            eq(certificateRequirements.status, 'Pending Upload'),
            eq(certificateRequirements.status, 'Deadline Expired')
          )
        )
      );

    return inserted;
  });

  return insertedExtension;
};
