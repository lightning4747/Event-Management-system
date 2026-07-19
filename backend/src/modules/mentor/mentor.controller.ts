import { Request, Response, NextFunction } from 'express';
import { createStudentSchema } from './mentor.types';
import * as mentorService from './mentor.service';
import { AppError } from '../../lib/errors';

export const onboardStudent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = createStudentSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(' ');
      throw new AppError(400, 'BAD_REQUEST', errorMsg);
    }

    const mentorUserId = req.user?.userId;
    if (!mentorUserId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authenticated user details.');
    }

    const studentData = await mentorService.createStudent(parseResult.data, mentorUserId);
    
    res.status(201).json(studentData);
  } catch (error) {
    next(error);
  }
};

export const listMentees = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const mentorUserId = req.user?.userId;
    if (!mentorUserId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authenticated user details.');
    }

    const menteesList = await mentorService.getMenteesList(mentorUserId);
    res.status(200).json(menteesList);
  } catch (error) {
    next(error);
  }
};
