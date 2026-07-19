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

    const history = await applicationsService.getStudentApplications(studentId);
    
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
