import { db } from '../../db';
import { odApplications, certificateRequirements, certificates } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '../../lib/errors';
import { UploadCertificateInput } from './certificates.types';

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
    .where(eq(certificateRequirements.requirementId, reqId))
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

  // 6. Perform upload inserts in transaction
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

    // Update requirement status
    await tx
      .update(certificateRequirements)
      .set({
        status: 'Uploaded',
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
