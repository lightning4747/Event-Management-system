import { Request, Response, NextFunction } from 'express';
import * as studentsService from './students.service';

export const listAllStudents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const role = req.user?.role;
    const requesterUserId = req.user?.userId;

    const year = req.query.year ? Number(req.query.year) : undefined;
    const section = req.query.section ? String(req.query.section).trim().toUpperCase() : undefined;

    const mentorId = role === 'Mentor' ? requesterUserId : undefined;

    const list = await studentsService.getAllStudents(year, section, mentorId);
    res.status(200).json(list);
  } catch (error) {
    next(error);
  }
};

export const getStudentDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const role = req.user?.role;
    const requesterUserId = req.user?.userId;

    const { id } = req.params;
    const details = await studentsService.getStudentCompleteRecord(id, role, requesterUserId);
    res.status(200).json(details);
  } catch (error) {
    next(error);
  }
};
