import jwt from 'jsonwebtoken';
import { AppError } from '../lib/errors';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' || process.env.VITEST ? 'test_jwt_secret_fallback_min_32_characters' : '');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is missing.');
}

if (process.env.NODE_ENV === 'production' && JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET environment variable must be at least 32 characters long in production.');
}

export interface JWTPayload {
  userId: string;
  role: string;
}

export const signToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
};

export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'The provided authentication token is invalid or expired.');
  }
};
