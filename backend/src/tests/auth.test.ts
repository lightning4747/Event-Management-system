import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticate } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { signToken } from '../utils/jwt';
import { Request, Response } from 'express';
import { clearDatabase, seedTestUsers } from './setup';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('Auth Middleware Unit & Integration Tests', () => {
  beforeEach(async () => {
    await clearDatabase();
    await seedTestUsers();
  });

  it('should pass authentication successfully for a valid, active user', async () => {
    // STUDENT_01 is seeded by seedTestUsers
    const token = signToken({ userId: 'STUDENT_01', role: 'Student' });
    const req = {
      headers: {
        authorization: `Bearer ${token}`
      }
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
    expect(req.user?.userId).toBe('STUDENT_01');
    expect(req.user?.role).toBe('Student');
  });

  it('should return 401 DEACTIVATED_USER for a soft-deleted/deactivated user', async () => {
    // Soft-delete STUDENT_01
    await db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.userId, 'STUDENT_01'));

    const token = signToken({ userId: 'STUDENT_01', role: 'Student' });
    const req = {
      headers: {
        authorization: `Bearer ${token}`
      }
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('DEACTIVATED_USER');
    expect(err.message).toBe('User account has been deactivated or deleted.');
  });

  it('should return 401 DEACTIVATED_USER if user does not exist in database', async () => {
    const token = signToken({ userId: 'NON_EXISTENT', role: 'Student' });
    const req = {
      headers: {
        authorization: `Bearer ${token}`
      }
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('DEACTIVATED_USER');
  });

  it('should pass a 401 INVALID_TOKEN AppError to next() for an invalid token format', async () => {
    const req = {
      headers: {
        authorization: 'Bearer invalidtoken123'
      }
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('INVALID_TOKEN');
    expect(err.message).toBe('Token is invalid or expired.');
  });

  it('should pass a 401 UNAUTHORIZED AppError to next() for a missing header', async () => {
    const req = {
      headers: {}
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('should pass a 401 UNAUTHORIZED AppError to next() for a non-Bearer scheme', async () => {
    const req = {
      headers: {
        authorization: 'Basic dXNlcjpwYXNz'
      }
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });
});
