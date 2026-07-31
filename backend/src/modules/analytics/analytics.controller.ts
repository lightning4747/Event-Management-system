import { Request, Response, NextFunction } from 'express';
import { analyticsFilterSchema } from './analytics.types';
import * as analyticsService from './analytics.service';
import { AppError } from '../../lib/errors';

export const getAnalyticsData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = analyticsFilterSchema.safeParse(req.query);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map((e) => e.message).join(' ');
      throw new AppError(400, 'BAD_REQUEST', errorMsg);
    }

    const data = await analyticsService.getAnalyticsData(parseResult.data);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};
