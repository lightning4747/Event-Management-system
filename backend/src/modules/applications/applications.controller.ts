import { Request, Response, NextFunction } from 'express';
import { createApplicationSchema } from './applications.types';
import * as applicationsService from './applications.service';
import { generateApplicationPdf } from './pdf.service';
import { AppError } from '../../lib/errors';
import { storageService } from '../../services/storage/storage.service';
import { buildProofKey, slugify, splitKey } from '../../services/storage/key-builder';
import { db } from '../../db';
import { students } from '../../db/schema';
import { eq } from 'drizzle-orm';

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

export const submitApplication = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const studentId = req.user?.userId;
    if (!studentId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authenticated student details.');
    }

    // When sent as multipart form-data, json fields like 'events' come as stringified JSON
    const bodyData = { ...req.body };
    if (typeof bodyData.events === 'string') {
      try {
        bodyData.events = JSON.parse(bodyData.events);
      } catch {
        // Leave as is if not valid JSON, let Zod catch it
      }
    }

    const parseResult = createApplicationSchema.safeParse(bodyData);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(' ');
      throw new AppError(400, 'BAD_REQUEST', errorMsg);
    }

    // Step 1: Create the application row (without proof URL — we need the applicationId first)
    const applicationData = await applicationsService.createApplication(
      { ...parseResult.data },
      studentId
    );

    // Step 2: If a proof file was provided, upload it to storage using the real applicationId
    let uploadedProofFileUrl: string | undefined;
    let uploadedProofFileName: string | undefined;

    if (req.file) {
      const proofFileName = req.file.originalname;

      // Fetch student's year/section to build a structured key
      const [studentRecord] = await db
        .select({ admissionYear: students.admissionYear, section: students.section })
        .from(students)
        .where(eq(students.userId, studentId))
        .limit(1);

      const yearFolder = studentRecord ? getAcademicYearName(studentRecord.admissionYear) : 'Unknown Year';
      const section = studentRecord?.section ?? 'Unknown';
      const rawExt = req.file.originalname.split('.').pop()?.toLowerCase() ?? 'pdf';

      const proofKey = buildProofKey({
        yearFolder,
        section,
        studentId,
        eventSlug: slugify(parseResult.data.title),
        applicationId: applicationData.applicationId,
        extension: rawExt,
      });
      const { folderPath, fileName } = splitKey(proofKey);

      const uploadResult = await storageService.uploadFile({
        fileName,
        folderPath,
        mimeType: req.file.mimetype,
        buffer: req.file.buffer,
      });

      // Step 3: Attach proof URL to the application row
      await applicationsService.updateProofUrl(
        applicationData.applicationId,
        uploadResult.fileUrl,
        proofFileName
      );

      uploadedProofFileUrl = uploadResult.fileUrl;
      uploadedProofFileName = proofFileName;
    }

    // Explicitly cast BigInt fields to string to prevent JSON serialization errors
    const serializedData = {
      ...applicationData,
      applicationId: applicationData.applicationId.toString(),
      proofFileUrl: uploadedProofFileUrl ?? null,
      proofFileName: uploadedProofFileName ?? null,
    };

    res.status(201).json(serializedData);
  } catch (error) {
    next(error);
  }
};



export const getStudentHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const studentId = req.user?.userId;
    if (!studentId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authenticated student details.');
    }

    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    const history = await applicationsService.getStudentApplications(studentId, limit, offset);

    // Serialize BigInt fields to string for JSON serialization compatibility
    const serializedHistory = history.map(app => ({
      ...app,
      applicationId: app.applicationId.toString(),
    }));

    res.status(200).json(serializedHistory);
  } catch (error) {
    next(error);
  }
};

export const listDepartmentApplications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const role = req.user?.role;
    const userId = req.user?.userId;

    if (!role || !userId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authenticated user details.');
    }

    if (!['Mentor', 'Event Coordinator', 'Program Coordinator', 'Head of Department'].includes(role)) {
      throw new AppError(403, 'FORBIDDEN', 'Access Denied: You do not have permissions to view department applications.');
    }

    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    const apps = await applicationsService.getDepartmentApplications(
      role as 'Mentor' | 'Event Coordinator' | 'Program Coordinator' | 'Head of Department',
      userId,
      limit,
      offset
    );

    const serializedApps = apps.map(app => ({
      ...app,
      applicationId: app.applicationId.toString(),
    }));

    res.status(200).json(serializedApps);
  } catch (error) {
    next(error);
  }
};

export const viewApplicationDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    if (!userId || !role) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authenticated user details.');
    }

    const { id } = req.params;
    let appId: bigint;
    try {
      appId = BigInt(id);
    } catch {
      throw new AppError(400, 'BAD_REQUEST', 'Invalid application ID format.');
    }

    const details = await applicationsService.getApplicationDetails(
      appId,
      userId,
      role as 'Student' | 'Mentor' | 'Event Coordinator' | 'Program Coordinator' | 'Head of Department' | 'Administrator'
    );

    const serializedDetails = {
      ...details,
      application: {
        ...details.application,
        applicationId: details.application.applicationId.toString(),
      },
      history: details.history.map(item => ({
        ...item,
        historyId: item.historyId.toString(),
        applicationId: item.applicationId.toString(),
      })),
      certificates: details.certificates.map(item => ({
        ...item,
        requirementId: item.requirementId.toString(),
      })),
      extension: details.extension
        ? {
            ...details.extension,
            extensionId: details.extension.extensionId.toString(),
          }
        : null,
    };

    res.status(200).json(serializedDetails);
  } catch (error) {
    next(error);
  }
};

export const withdrawApplication = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const studentId = req.user?.userId;
    if (!studentId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authenticated student details.');
    }

    const { id } = req.params;
    let appId: bigint;
    try {
      appId = BigInt(id);
    } catch {
      throw new AppError(400, 'BAD_REQUEST', 'Invalid application ID format.');
    }

    const result = await applicationsService.withdrawApplication(appId, studentId);

    res.status(200).json({
      newStatus: result.newStatus,
    });
  } catch (error) {
    next(error);
  }
};

export const exportApplicationPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const studentId = req.user?.userId;
    if (!studentId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authenticated student details.');
    }

    const { id } = req.params;
    let appId: bigint;
    try {
      appId = BigInt(id);
    } catch {
      throw new AppError(400, 'BAD_REQUEST', 'Invalid application ID format.');
    }

    const pdfBuffer = await generateApplicationPdf(appId, studentId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="OD_Application_${appId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.status(200).send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};
