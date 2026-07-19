import { Request, Response, NextFunction } from 'express';
import { createExtensionSchema } from './extensions.types';
import * as extensionsService from './extensions.service';
import { AppError } from '../../lib/errors';

export const handleCreateExtension = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const mentorUserId = req.user?.userId;
    const role = req.user?.role;
    if (!mentorUserId || role !== 'Mentor') {
      throw new AppError(403, 'FORBIDDEN', 'Access Denied: Only Mentors can grant deadline extensions.');
    }

    const parseResult = createExtensionSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(' ');
      throw new AppError(400, 'BAD_REQUEST', errorMsg);
    }

    const result = await extensionsService.createDeadlineExtension(mentorUserId, parseResult.data);
    
    // Format BigInt fields for JSON compatibility
    const serializedData = {
      ...result,
      extensionId: result.extensionId.toString(),
    };

    res.status(201).json(serializedData);
  } catch (error) {
    next(error);
  }
};
