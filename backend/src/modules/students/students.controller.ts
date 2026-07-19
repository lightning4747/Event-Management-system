import { Request, Response, NextFunction } from 'express';
import * as studentsService from './students.service';

export const listAllStudents = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const list = await studentsService.getAllStudents();
    res.status(200).json(list);
  } catch (error) {
    next(error);
  }
};

export const getStudentDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const details = await studentsService.getStudentCompleteRecord(id);
    res.status(200).json(details);
  } catch (error) {
    next(error);
  }
};
