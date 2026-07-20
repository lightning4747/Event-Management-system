import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../middleware/error';
import { Request, Response } from 'express';

interface PgError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
}

describe('Error Handler Middleware - Postgres Code Translation', () => {
  const mockRequest = {
    url: '/api/test',
    method: 'POST'
  } as Request;

  const createMockResponse = () => {
    const res = {} as Response;
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  const next = vi.fn();

  it('should translate 23505 Unique Violation error to 409 CONFLICT', () => {
    const dbError = new Error('duplicate key value violates unique constraint') as PgError;
    dbError.code = '23505';
    dbError.detail = 'Key (userId)=(STUDENT_01) already exists.';

    const res = createMockResponse();

    errorHandler(dbError, mockRequest, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'CONFLICT',
        message: 'Key (userId)=(STUDENT_01) already exists.'
      }
    });
  });

  it('should translate 23514 check constraint error for from_date_less_to_date_check to 400 BAD_REQUEST', () => {
    const dbError = new Error('new row violates check constraint') as PgError;
    dbError.code = '23514';
    dbError.constraint = 'from_date_less_to_date_check';

    const res = createMockResponse();

    errorHandler(dbError, mockRequest, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'BAD_REQUEST',
        message: 'The start date must be less than or equal to the end date.'
      }
    });
  });

  it('should translate 23514 check constraint error for number_of_events_positive_check to 400 BAD_REQUEST', () => {
    const dbError = new Error('new row violates check constraint') as PgError;
    dbError.code = '23514';
    dbError.constraint = 'number_of_events_positive_check';

    const res = createMockResponse();

    errorHandler(dbError, mockRequest, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'BAD_REQUEST',
        message: 'The number of events must be greater than 0.'
      }
    });
  });

  it('should translate 23503 Foreign Key constraint error to 400 BAD_REQUEST', () => {
    const dbError = new Error('insert or update violates foreign key constraint') as PgError;
    dbError.code = '23503';

    const res = createMockResponse();

    errorHandler(dbError, mockRequest, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'BAD_REQUEST',
        message: 'Referenced entity does not exist.'
      }
    });
  });

  it('should fallback to 500 INTERNAL_SERVER_ERROR for standard unhandled errors', () => {
    const standardError = new Error('some standard runtime exception');
    const res = createMockResponse();

    errorHandler(standardError, mockRequest, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred on the server.'
      }
    });
  });
});
