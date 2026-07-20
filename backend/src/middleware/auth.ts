import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AppError } from '../lib/errors';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authorization header is missing or malformed.'));
  }

  const token = authHeader.split(' ')[1];
  
  let decoded: { userId: string; role: string };
  try {
    decoded = verifyToken(token) as { userId: string; role: string };
  } catch {
    return next(new AppError(401, 'INVALID_TOKEN', 'Token is invalid or expired.'));
  }

  try {
    const [userRecord] = await db
      .select({ deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.userId, decoded.userId))
      .limit(1);

    if (!userRecord || userRecord.deletedAt !== null) {
      return next(new AppError(401, 'DEACTIVATED_USER', 'User account has been deactivated or deleted.'));
    }

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
