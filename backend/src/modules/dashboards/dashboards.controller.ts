import { Request, Response, NextFunction } from 'express';
import * as dashboardsService from './dashboards.service';
import { AppError } from '../../lib/errors';

export const getStudentDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const studentId = req.user?.userId;
    const role = req.user?.role;
    if (!studentId || role !== 'Student') {
      throw new AppError(403, 'FORBIDDEN', 'Access Denied: Only Students can access the student dashboard.');
    }

    const metrics = await dashboardsService.getStudentDashboardMetrics(studentId);
    res.status(200).json(metrics);
  } catch (error) {
    next(error);
  }
};

export const getCoordinatorDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const role = req.user?.role;
    if (role !== 'Event Coordinator') {
      throw new AppError(403, 'FORBIDDEN', 'Access Denied: Only Event Coordinators can access this dashboard.');
    }

    const metrics = await dashboardsService.getECDashboardMetrics();
    res.status(200).json(metrics);
  } catch (error) {
    next(error);
  }
};

export const getMentorDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const mentorUserId = req.user?.userId;
    const role = req.user?.role;
    if (!mentorUserId || role !== 'Mentor') {
      throw new AppError(403, 'FORBIDDEN', 'Access Denied: Only Mentors can access the mentor dashboard.');
    }

    const metrics = await dashboardsService.getMentorDashboardMetrics(mentorUserId);
    res.status(200).json(metrics);
  } catch (error) {
    next(error);
  }
};
