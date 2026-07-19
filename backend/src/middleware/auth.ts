import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AppError } from '../lib/errors';

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authorization header is missing or malformed.'));
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user || !user.role) {
      return next(new AppError(401, 'UNAUTHORIZED', 'User session context not authenticated.'));
    }

    if (!allowedRoles.includes(user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'Access Denied: Insufficient permissions for this operation.'));
    }

    next();
  };
};
