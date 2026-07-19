import { Request, Response, NextFunction } from 'express';
import { updateProfileSchema } from './profile.types';
import * as profileService from './profile.service';
import { AppError } from '../../lib/errors';

export const viewProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    
    if (!userId || !role) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authenticated user details.');
    }

    const profileData = await profileService.getProfile(userId, role);
    res.status(200).json(profileData);
  } catch (error) {
    next(error);
  }
};

export const editProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authenticated user details.');
    }

    const parseResult = updateProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(' ');
      throw new AppError(400, 'BAD_REQUEST', errorMsg);
    }

    const updatedData = await profileService.updateProfile(userId, parseResult.data);
    res.status(200).json(updatedData);
  } catch (error) {
    next(error);
  }
};
