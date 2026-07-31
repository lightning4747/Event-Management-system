import { describe, it, expect, vi } from 'vitest';
import { requireRole } from '../middleware/auth';
import { downloadGlobalReport } from '../modules/reports/reports.controller';
import { AppError } from '../lib/errors';
import { Request, Response } from 'express';

describe('Reports Global CSV Export Role Authorization', () => {
  it('allows Head of Department (HOD) in requireRole middleware', () => {
    const middleware = requireRole(['Event Coordinator', 'Program Coordinator', 'Head of Department']);
    const req = { user: { userId: 'HOD_01', role: 'Head of Department' } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('allows Program Coordinator (PC) in requireRole middleware', () => {
    const middleware = requireRole(['Event Coordinator', 'Program Coordinator', 'Head of Department']);
    const req = { user: { userId: 'PC_01', role: 'Program Coordinator' } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('allows Event Coordinator (EC) in requireRole middleware', () => {
    const middleware = requireRole(['Event Coordinator', 'Program Coordinator', 'Head of Department']);
    const req = { user: { userId: 'EC_01', role: 'Event Coordinator' } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('blocks Student in requireRole middleware with 403 FORBIDDEN', () => {
    const middleware = requireRole(['Event Coordinator', 'Program Coordinator', 'Head of Department']);
    const req = { user: { userId: 'STU_01', role: 'Student' } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
  });

  it('allows HOD in downloadGlobalReport controller', async () => {
    const req = { user: { userId: 'HOD_01', role: 'Head of Department' }, query: {} } as unknown as Request;
    const setHeaderMock = vi.fn();
    const sendMock = vi.fn();
    const res = {
      setHeader: setHeaderMock,
      status: vi.fn().mockReturnThis(),
      send: sendMock,
    } as unknown as Response;
    const next = vi.fn();

    await downloadGlobalReport(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', 'text/csv');
  });
});
