import jwt from 'jsonwebtoken';
import { AppError } from '../lib/errors';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '1d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is missing.');
}

export interface JWTPayload {
  userId: string;
  role: string;
}

export const signToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new AppError(401, 'INVALID_TOKEN', 'The provided authentication token is invalid or expired.');
  }
};
