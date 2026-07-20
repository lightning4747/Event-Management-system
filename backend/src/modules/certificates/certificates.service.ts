import { db } from '../../db';
import { odApplications, certificateRequirements, certificates, users } from '../../db/schema';
import { eq, lt, and, isNull } from 'drizzle-orm';
import { AppError } from '../../lib/errors';
import { UploadCertificateInput, VerifyCertificateInput } from './certificates.types';

export const uploadCertificate = async (
  userId: string,
  input: UploadCertificateInput
): Promise<{ certificateId: bigint; requirementId: bigint; fileUrl: string; uploadVersion: number }> => {
  let reqId: bigint;
  try {
    reqId = BigInt(input.requirementId);
  } catch {
    throw new AppError(400, 'BAD_REQUEST', 'Invalid requirement ID format.');
  }

  // 1. Fetch certificate requirement detail joined with OD application
  const [req] = await db
    .select({
      requirementId: certificateRequirements.requirementId,
      applicationId: certificateRequirements.applicationId,
      status: certificateRequirements.status,
      submissionDeadline: certificateRequirements.submissionDeadline,
      studentId: odApplications.studentId,
      toDate: odApplications.toDate,
    })
    .from(certificateRequirements)
    .innerJoin(odApplications, eq(certificateRequirements.applicationId, odApplications.applicationId))
    .innerJoin(users, eq(odApplications.studentId, users.userId))
    .where(
      and(
        eq(certificateRequirements.requirementId, reqId),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (!req) {
    throw new AppError(404, 'NOT_FOUND', 'Certificate requirement not found.');
  }

  // 2. Validate ownership
  if (req.studentId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Access Denied: You do not own this application requirement.');
  }

  // 3. Verify event end date has passed
  const currentDateStr = new Date().toISOString().split('T')[0];
  if (currentDateStr <= req.toDate) {
    throw new AppError(400, 'EVENT_NOT_CONCLUDED', 'You can only upload certificates after the event dates have concluded.');
  }

  // 4. Verify requirement is uploadable (not verified yet)
  if (req.status === 'Verified') {
    throw new AppError(400, 'REQUIREMENT_VERIFIED', 'This requirement is already verified and locked.');
  }

  // 5. Check if deadline has already expired
  if (req.status === 'Deadline Expired') {
    throw new AppError(400, 'DEADLINE_EXPIRED', 'The submission deadline has expired. Contact your mentor for an extension.');
  }

  // 6. Perform upload inserts in transaction (supports re-upload while preserving history)
  const result = await db.transaction(async (tx) => {
    // Check previous upload count
    const existingCerts = await tx
      .select()
      .from(certificates)
      .where(eq(certificates.requirementId, reqId));

    const uploadVersion = existingCerts.length + 1;

    // Reset isCurrent on old files
    await tx
      .update(certificates)
      .set({ isCurrent: false })
      .where(eq(certificates.requirementId, reqId));

    // Insert new certificate record
    const [inserted] = await tx
      .insert(certificates)
      .values({
        requirementId: reqId,
        fileUrl: input.fileUrl,
        uploadVersion,
        isCurrent: true,
      })
      .returning({
        certificateId: certificates.certificateId,
        requirementId: certificates.requirementId,
        fileUrl: certificates.fileUrl,
        uploadVersion: certificates.uploadVersion,
      });

    // Update requirement status to Uploaded
    await tx
      .update(certificateRequirements)
      .set({
        status: 'Uploaded',
        rejectionReason: null, // Clear past rejection comments upon re-upload
        updatedAt: new Date(),
      })
      .where(eq(certificateRequirements.requirementId, reqId));

    return inserted;
  });

  return {
    ...result,
    uploadVersion: Number(result.uploadVersion),
  };
};

export const verifyCertificate = async (
  requirementId: bigint,
  input: VerifyCertificateInput
): Promise<{ requirementId: bigint; status: 'Verified' | 'Rejected'; rejectionReason: string | null }> => {
  const result = await db.transaction(async (tx) => {
    const [req] = await tx
      .select({
        requirementId: certificateRequirements.requirementId,
        status: certificateRequirements.status,
      })
      .from(certificateRequirements)
      .innerJoin(odApplications, eq(certificateRequirements.applicationId, odApplications.applicationId))
      .innerJoin(users, eq(odApplications.studentId, users.userId))
      .where(
        and(
          eq(certificateRequirements.requirementId, requirementId),
          isNull(users.deletedAt)
        )
      )
      .for('update', { of: certificateRequirements })
      .limit(1);

    if (!req) {
      throw new AppError(404, 'NOT_FOUND', 'Certificate requirement not found.');
    }

    // Verification can only be done if status is Uploaded
    if (req.status !== 'Uploaded') {
      throw new AppError(400, 'INVALID_STATUS', 'No active certificate upload is available to verify for this requirement.');
    }

    await tx
      .update(certificateRequirements)
      .set({
        status: input.status,
        rejectionReason: input.status === 'Rejected' ? input.comments || null : null,
        updatedAt: new Date(),
      })
      .where(eq(certificateRequirements.requirementId, requirementId));

    return {
      requirementId,
      status: input.status,
      rejectionReason: input.status === 'Rejected' ? input.comments || null : null,
    };
  });

  return result;
};

export const checkCertificateDeadlines = async (): Promise<number> => {
  const currentDateStr = new Date().toISOString().split('T')[0];

  const expiredReqs = await db
    .update(certificateRequirements)
    .set({
      status: 'Deadline Expired',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(certificateRequirements.status, 'Pending Upload'),
        lt(certificateRequirements.submissionDeadline, currentDateStr)
      )
    )
    .returning({
      requirementId: certificateRequirements.requirementId,
    });

  return expiredReqs.length;
};
