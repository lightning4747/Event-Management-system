import { describe, it, expect, vi } from 'vitest';
import { requireRole } from '../middleware/auth';
import { getAnalyticsData } from '../modules/analytics/analytics.service';
import { Request, Response } from 'express';
import { AppError } from '../lib/errors';

describe('Analytics Dashboard Backend Unit Tests', () => {
  it('allows Event Coordinator, Program Coordinator, HOD, and Admin in requireRole middleware', () => {
    const middleware = requireRole(['Event Coordinator', 'Program Coordinator', 'Head of Department', 'Administrator']);
    const req = { user: { userId: 'EC_01', role: 'Event Coordinator' } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('denies Student role from accessing analytics with 403 FORBIDDEN', () => {
    const middleware = requireRole(['Event Coordinator', 'Program Coordinator', 'Head of Department', 'Administrator']);
    const req = { user: { userId: 'STU_01', role: 'Student' } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
  });

  it('fetches aggregated analytics structure without crashing on empty filters', async () => {
    const data = await getAnalyticsData({});
    expect(data).toHaveProperty('summary');
    expect(data.summary).toHaveProperty('totalApplications');
    expect(data.summary).toHaveProperty('approved');
    expect(data.summary).toHaveProperty('pending');
    expect(data.summary).toHaveProperty('rejected');
    expect(data.summary).toHaveProperty('certificatesUploaded');
    expect(data.summary).toHaveProperty('certificatesVerified');

    expect(Array.isArray(data.monthlyTrend)).toBe(true);
    expect(Array.isArray(data.byStudentYear)).toBe(true);
    expect(Array.isArray(data.bySectionGrouped)).toBe(true);
    expect(Array.isArray(data.statusDistribution)).toBe(true);
    expect(Array.isArray(data.categoryDistribution)).toBe(true);
    expect(Array.isArray(data.activityTypeDistribution)).toBe(true);
    expect(Array.isArray(data.certificateStatusDistribution)).toBe(true);
  });
});
