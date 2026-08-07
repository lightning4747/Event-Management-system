import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AppError } from '../lib/errors';

export const generateCsrfToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const setCsrfCookie = (res: Response, token: string): void => {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false, // JS readable so frontend can send X-XSRF-TOKEN header
    secure: isProd,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
};

/**
 * Ensures an active XSRF-TOKEN cookie exists on GET/initial requests.
 */
export const ensureCsrfToken = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.cookies?.['XSRF-TOKEN']) {
    const freshToken = generateCsrfToken();
    setCsrfCookie(res, freshToken);
  }
  next();
};

/**
 * Double-Submit Cookie CSRF Guard with timing-safe comparison.
 * Bypasses GET, HEAD, OPTIONS and /api/auth/login.
 */
export const csrfGuard = (req: Request, _res: Response, next: NextFunction): void => {
  // Safe HTTP methods do not require CSRF validation
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Bypass login endpoint so unauthenticated users can submit credentials to retrieve initial token pair
  const cleanPath = req.path.replace(/\/$/, '');
  if (cleanPath === '/auth/login' || cleanPath === '/api/auth/login') {
    return next();
  }

  const cookieCsrfToken = req.cookies?.['XSRF-TOKEN'];
  const headerCsrfToken = (req.headers['x-xsrf-token'] || req.headers['x-csrf-token']) as string | undefined;

  if (!cookieCsrfToken || !headerCsrfToken) {
    return next(new AppError(403, 'CSRF_VALIDATION_FAILED', 'CSRF validation failed: Missing token.'));
  }

  const cookieBuf = Buffer.from(cookieCsrfToken);
  const headerBuf = Buffer.from(headerCsrfToken);

  // Buffer length check prevents timingSafeEqual runtime crashes on mismatched token lengths
  if (cookieBuf.length !== headerBuf.length || !crypto.timingSafeEqual(cookieBuf, headerBuf)) {
    return next(new AppError(403, 'CSRF_VALIDATION_FAILED', 'CSRF validation failed: Token mismatch.'));
  }

  next();
};
