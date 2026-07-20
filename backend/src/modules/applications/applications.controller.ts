import { Request, Response, NextFunction } from 'express';
import { createApplicationSchema } from './applications.types';
import * as applicationsService from './applications.service';
import { AppError } from '../../lib/errors';

export const submitApplication = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const studentId = req.user?.userId;
    if (!studentId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authenticated student details.');
    }

    const parseResult = createApplicationSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(' ');
      throw new AppError(400, 'BAD_REQUEST', errorMsg);
    }

    const applicationData = await applicationsService.createApplication(parseResult.data, studentId);
    
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

    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    const list = await applicationsService.getDepartmentApplications(role, userId, limit, offset);
    
    // Serialize BigInt fields to string for JSON serialization compatibility
    const serializedList = list.map(app => ({
      ...app,
      applicationId: app.applicationId.toString(),
    }));

    res.status(200).json(serializedList);
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

    const details = await applicationsService.getApplicationDetails(appId, userId, role);
    
    // Safely cast all BigInt identifiers to strings for JSON compliance
    const serializedDetails = {
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
        uploadVersion: item.uploadVersion !== null ? Number(item.uploadVersion) : null,
      })),
      extension: details.extension || null,
    };

    res.status(200).json(serializedDetails);
  } catch (error) {
    next(error);
  }
};

export const withdrawApplication = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const studentId = req.user?.userId;
    const role = req.user?.role;
    if (!studentId || role !== 'Student') {
      throw new AppError(403, 'FORBIDDEN', 'Only students can withdraw their own applications.');
    }

    const { id } = req.params;
    let appId: bigint;
    try {
      appId = BigInt(id);
    } catch {
      throw new AppError(400, 'BAD_REQUEST', 'Invalid application ID format.');
    }

    const result = await applicationsService.withdrawApplication(appId, studentId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
