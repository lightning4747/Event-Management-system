import { Request, Response, NextFunction } from 'express';
import { loginSchema } from './auth.types';
import * as authService from './auth.service';
import { AppError } from '../../lib/errors';
import { generateCsrfToken, setCsrfCookie } from '../../middleware/csrf';

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(' ');
      throw new AppError(400, 'BAD_REQUEST', errorMsg);
    }

    const sessionData = await authService.loginUser(parseResult.data);

    const isProd = process.env.NODE_ENV === 'production';

    // 1. Set HttpOnly JWT session cookie
    res.cookie('mcet_auth_token', sessionData.token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    // 2. Set JS-readable CSRF Token cookie
    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);

    res.status(200).json({
      token: sessionData.token,
      role: sessionData.role,
      userId: sessionData.userId,
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie('mcet_auth_token', { path: '/' });
  res.clearCookie('XSRF-TOKEN', { path: '/' });
  res.status(200).json({ message: 'Successfully signed out.' });
};
