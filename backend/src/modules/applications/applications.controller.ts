import { Request, Response, NextFunction } from 'express';
import { createApplicationSchema } from './applications.types';
import * as applicationsService from './applications.service';
import { AppError } from '../../lib/errors';
import { storageService } from '../../services/storage/storage.service';

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

    let proofFileUrl: string | undefined;
    let proofFileName: string | undefined;

    if (req.file) {
      proofFileName = req.file.originalname;
      const sanitizeSegment = (str: string): string => str.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `${Date.now()}_${sanitizeSegment(req.file.originalname)}`;
      const folderPath = `Proofs/${studentId}`;

      const uploadResult = await storageService.uploadFile({
        fileName: filename,
        folderPath,
        mimeType: req.file.mimetype,
        buffer: req.file.buffer,
      });

      proofFileUrl = uploadResult.fileUrl;
    }

    const applicationData = await applicationsService.createApplication(
      {
        ...parseResult.data,
        proofFileUrl,
        proofFileName,
      },
      studentId
    );

    // Explicitly cast BigInt fields to string to prevent JSON serialization errors
    const serializedData = {
      ...applicationData,
      applicationId: applicationData.applicationId.toString(),
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
