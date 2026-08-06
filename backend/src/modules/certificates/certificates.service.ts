import { db } from '../../db';
import { odApplications, certificateRequirements, certificates, users, students } from '../../db/schema';
import { eq, lt, and, isNull } from 'drizzle-orm';
import { AppError } from '../../lib/errors';
import { UploadCertificateInput, VerifyCertificateInput } from './certificates.types';
import { isAchievementEligible } from '../applications/applications.types';
import { storageService } from '../../services/storage/storage.service';
import { buildCertificateKey, slugify, splitKey } from '../../services/storage/key-builder';

const getAcademicYearName = (admissionYear: number): string => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const academicStartYear = currentMonth >= 5 ? currentYear : currentYear - 1;
  const diff = academicStartYear - admissionYear;
  switch (diff) {
    case 0: return 'First Year';
    case 1: return 'Second Year';
    case 2: return 'Third Year';
    case 3: return 'Fourth Year';
    default: return `${diff + 1}th Year`;
  }
};

export const uploadCertificate = async (
  userId: string,
  input: UploadCertificateInput,
  file?: Express.Multer.File
): Promise<{ certificateId: bigint; requirementId: bigint; fileUrl: string; uploadVersion: number }> => {
  let reqId: bigint;
  try {
    reqId = BigInt(input.requirementId);
  } catch {
    throw new AppError(400, 'BAD_REQUEST', 'Invalid requirement ID format.');
  }

  // 1. Fetch certificate requirement detail joined with OD application & student
  const [req] = await db
    .select({
      requirementId: certificateRequirements.requirementId,
      applicationId: certificateRequirements.applicationId,
      status: certificateRequirements.status,
      submissionDeadline: certificateRequirements.submissionDeadline,
      reqActivityCategory: certificateRequirements.activityCategory,
      reqActivityType: certificateRequirements.activityType,
      studentId: odApplications.studentId,
      toDate: odApplications.toDate,
      title: odApplications.title,
      appActivityCategory: odApplications.activityCategory,
      appActivityType: odApplications.activityType,
      admissionYear: students.admissionYear,
      section: students.section,
    })
    .from(certificateRequirements)
    .innerJoin(odApplications, eq(certificateRequirements.applicationId, odApplications.applicationId))
    .innerJoin(students, eq(odApplications.studentId, students.userId))
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

  // 3. Verify event has reached its end date
  const currentDateStr = new Date().toISOString().split('T')[0];
  if (currentDateStr < req.toDate) {
    throw new AppError(400, 'EVENT_NOT_CONCLUDED', 'You can only upload certificates on or after the event end date.');
  }

  // 4. Verify requirement is uploadable (not verified yet)
  if (req.status === 'Verified') {
    throw new AppError(400, 'REQUIREMENT_VERIFIED', 'This requirement is already verified and locked.');
  }

  // 5. Check if deadline has already expired
  if (req.status === 'Deadline Expired') {
    throw new AppError(400, 'DEADLINE_EXPIRED', 'The submission deadline has expired. Contact your mentor for an extension.');
  }

  let fileUrl = input.fileUrl || '';

  if (!file && !fileUrl) {
    throw new AppError(400, 'BAD_REQUEST', 'Please provide a PDF file to upload.');
  }

  const yearFolder = getAcademicYearName(req.admissionYear);
  const activeCategory = req.reqActivityCategory || req.appActivityCategory || 'Co-curricular';
  const activeType = req.reqActivityType || req.appActivityType || 'General';
  const categoryFolder = activeCategory === 'Co-curricular'
    ? 'Cocurricular'
    : activeCategory;
  const subFolder = activeType.replace(/[^a-zA-Z0-9 _-]/g, '_').trim();


  const result = await db.transaction(async (tx) => {
    const existingCerts = await tx
      .select()
      .from(certificates)
      .where(eq(certificates.requirementId, reqId))
      .for('update');

    const uploadVersion = existingCerts.length + 1;
    const oldCert = existingCerts.find((c) => c.isCurrent);
    let driveItemId: string | null = null;
    let fileName: string | null = null;


    if (file) {
      const eventSlug = slugify(req.title);
      const s3Key = buildCertificateKey({
        yearFolder,
        section: req.section,
        studentId: req.studentId,
        categoryFolder,
        subFolder,
        eventSlug,
        requirementId: reqId,
        version: uploadVersion,
      });
      const { folderPath: certFolderPath, fileName: certFileName } = splitKey(s3Key);

      const storageResult = await storageService.uploadFile({
        fileName: certFileName,
        folderPath: certFolderPath,
        mimeType: file.mimetype || 'application/pdf',
        buffer: file.buffer,
      });
      fileUrl = storageResult.fileUrl;
      driveItemId = storageResult.fileId;
      fileName = certFileName;

      if (oldCert && oldCert.driveItemId) {
        await storageService.deleteFile(oldCert.driveItemId);
      }
    }

    // Reset isCurrent on old files
    await tx
      .update(certificates)
      .set({ isCurrent: false })
      .where(eq(certificates.requirementId, reqId));

    // Insert new certificate record
    const [newCert] = await tx
      .insert(certificates)
      .values({
        requirementId: reqId,
        driveItemId: driveItemId || null,
        fileName: fileName || null,
        fileUrl,
        uploadVersion,
        isCurrent: true,
      })
      .returning();

    // Update certificate requirement status to 'Uploaded'
    await tx
      .update(certificateRequirements)
      .set({
        status: 'Uploaded',
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(certificateRequirements.requirementId, reqId));

    // Update achievement position and award name on odApplications if provided and eligible
    if (input.achievement || input.awardName !== undefined) {
      const activeCategory = req.reqActivityCategory || req.appActivityCategory || 'Co-curricular';
      const activeType = req.reqActivityType || req.appActivityType || 'General';
      const isEligible = isAchievementEligible(activeCategory, activeType);
      const finalAchievement = isEligible && input.achievement ? input.achievement : 'Participation';
      const finalAwardName = isEligible && input.awardName ? input.awardName.trim() : null;

      await tx
        .update(odApplications)
        .set({
          achievement: finalAchievement,
          awardName: finalAwardName,
        })
        .where(eq(odApplications.applicationId, req.applicationId));
    }

    return {
      certificateId: newCert.certificateId,
      requirementId: newCert.requirementId,
      fileUrl: newCert.fileUrl,
      uploadVersion: newCert.uploadVersion,
    };
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
        reqActivityCategory: certificateRequirements.activityCategory,
        reqActivityType: certificateRequirements.activityType,
        appActivityCategory: odApplications.activityCategory,
        appActivityType: odApplications.activityType,
        studentId: odApplications.studentId,
        title: odApplications.title,
        admissionYear: students.admissionYear,
        section: students.section,
      })
      .from(certificateRequirements)
      .innerJoin(odApplications, eq(certificateRequirements.applicationId, odApplications.applicationId))
      .innerJoin(students, eq(odApplications.studentId, students.userId))
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

    if (req.status !== 'Uploaded') {
      throw new AppError(400, 'INVALID_STATUS', 'No active certificate upload is available to verify for this requirement.');
    }

    if (input.status === 'Verified') {
      // Certificate is already in S3 from when the student uploaded it — no re-upload needed.
      // The stored fileId (driveItemId) is the S3 key; it remains intact.
    } else if (input.status === 'Rejected') {
      // On rejection, delete the uploaded file from storage so the student re-uploads fresh
      const [currentCert] = await tx
        .select()
        .from(certificates)
        .where(
          and(
            eq(certificates.requirementId, requirementId),
            eq(certificates.isCurrent, true)
          )
        )
        .limit(1);

      if (currentCert && currentCert.driveItemId) {
        await storageService.deleteFile(currentCert.driveItemId);
      }
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

export const skipCertificateUpload = async (
  userId: string,
  requirementId: bigint
): Promise<{ requirementId: bigint; status: 'Skipped' }> => {
  const [req] = await db
    .select({
      requirementId: certificateRequirements.requirementId,
      status: certificateRequirements.status,
      studentId: odApplications.studentId,
    })
    .from(certificateRequirements)
    .innerJoin(odApplications, eq(certificateRequirements.applicationId, odApplications.applicationId))
    .where(eq(certificateRequirements.requirementId, requirementId))
    .limit(1);

  if (!req) {
    throw new AppError(404, 'NOT_FOUND', 'Certificate requirement not found.');
  }

  if (req.studentId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Access Denied: You do not own this application requirement.');
  }

  if (req.status === 'Verified') {
    throw new AppError(400, 'REQUIREMENT_VERIFIED', 'This requirement is already verified and locked.');
  }

  await db
    .update(certificateRequirements)
    .set({
      status: 'Skipped',
      updatedAt: new Date(),
    })
    .where(eq(certificateRequirements.requirementId, requirementId));

  return {
    requirementId,
    status: 'Skipped',
  };
};
