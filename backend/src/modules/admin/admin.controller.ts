import { Request, Response, NextFunction } from 'express';
import { createFacultySchema, assignRoleSchema, updateFacultySchema } from './admin.types';
import * as adminService from './admin.service';
import { AppError } from '../../lib/errors';

export const onboardFaculty = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = createFacultySchema.safeParse(req.body);
    
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(' ');
      throw new AppError(400, 'BAD_REQUEST', errorMsg);
    }

    const adminUserId = req.user?.userId;
    if (!adminUserId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authenticated user details.');
    }

    const facultyData = await adminService.createFaculty(parseResult.data, adminUserId);
    
    res.status(201).json(facultyData);
  } catch (error) {
    next(error);
  }
};

export const listFaculty = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const facultyList = await adminService.getFacultyList();
    res.status(200).json(facultyList);
  } catch (error) {
    next(error);
  }
};

export const assignRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = assignRoleSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(' ');
      throw new AppError(400, 'BAD_REQUEST', errorMsg);
    }

    const updatedUser = await adminService.assignSpecialRole(parseResult.data);
    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};

export const handleUpdateFaculty = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.params.userId;
    const parseResult = updateFacultySchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(' ');
      throw new AppError(400, 'BAD_REQUEST', errorMsg);
    }

    const updated = await adminService.updateFaculty(userId, parseResult.data);
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};
