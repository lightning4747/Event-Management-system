import { Request, Response, NextFunction } from 'express';
import { loginSchema } from './auth.types';
import * as authService from './auth.service';
import { AppError } from '../../lib/errors';

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(' ');
      throw new AppError(400, 'BAD_REQUEST', errorMsg);
    }

    const sessionData = await authService.loginUser(parseResult.data);
    
    res.status(200).json(sessionData);
  } catch (error) {
    next(error);
  }
};
