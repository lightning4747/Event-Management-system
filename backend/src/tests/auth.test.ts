import { describe, it, expect, vi } from 'vitest';
import { authenticate } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { signToken } from '../utils/jwt';
import { Request, Response } from 'express';

describe('Auth Middleware Unit Tests', () => {
  it('should pass authentication successfully for a valid token', () => {
    const token = signToken({ userId: 'STUDENT_01', role: 'Student' });
    const req = {
      headers: {
        authorization: `Bearer ${token}`
      }
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
    expect(req.user?.userId).toBe('STUDENT_01');
    expect(req.user?.role).toBe('Student');
  });

  it('should pass a 401 INVALID_TOKEN AppError to next() for an invalid token', () => {
    const req = {
      headers: {
        authorization: 'Bearer invalidtoken123'
      }
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('INVALID_TOKEN');
    expect(err.message).toBe('Token is invalid or expired.');
  });

  it('should pass a 401 UNAUTHORIZED AppError to next() for a missing header', () => {
    const req = {
      headers: {}
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('should pass a 401 UNAUTHORIZED AppError to next() for a non-Bearer scheme', () => {
    const req = {
      headers: {
        authorization: 'Basic dXNlcjpwYXNz'
      }
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });
});
