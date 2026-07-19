import { Request, Response, NextFunction } from 'express';
import { exportFilterSchema } from './reports.types';
import * as reportsService from './reports.service';
import { AppError } from '../../lib/errors';

export const downloadGlobalReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const role = req.user?.role;
    const allowedRoles = ['Event Coordinator', 'Program Coordinator', 'Head of Department'];
    if (!role || !allowedRoles.includes(role)) {
      throw new AppError(403, 'FORBIDDEN', 'Access Denied: You do not have permissions to download global reports.');
    }

    const parseResult = exportFilterSchema.safeParse(req.query);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(' ');
      throw new AppError(400, 'BAD_REQUEST', errorMsg);
    }

    const csvContent = await reportsService.generateGlobalReport(parseResult.data);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=global_od_report.csv');
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

export const downloadCohortReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const mentorUserId = req.user?.userId;
    const role = req.user?.role;
    if (!mentorUserId || role !== 'Mentor') {
      throw new AppError(403, 'FORBIDDEN', 'Access Denied: Only cohort mentors can download cohort reports.');
    }

    const parseResult = exportFilterSchema.safeParse(req.query);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(' ');
      throw new AppError(400, 'BAD_REQUEST', errorMsg);
    }

    const csvContent = await reportsService.generateCohortReport(mentorUserId, parseResult.data);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=cohort_od_report.csv');
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};
