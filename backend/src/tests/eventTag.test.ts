import { describe, it, expect } from 'vitest';
import { computeEventTag } from '../modules/applications/applications.service';

describe('computeEventTag Unit Tests', () => {
  it('should return undefined for unapproved applications (In Progress, Rejected, Withdrawn)', () => {
    expect(computeEventTag('2026-09-01', '2026-09-03', 'In Progress: Event Coordinator')).toBeUndefined();
    expect(computeEventTag('2026-09-01', '2026-09-03', 'In Progress: Mentor')).toBeUndefined();
    expect(computeEventTag('2026-09-01', '2026-09-03', 'Rejected')).toBeUndefined();
    expect(computeEventTag('2026-09-01', '2026-09-03', 'Withdrawn')).toBeUndefined();
  });

  it('should compute appropriate certificate eventTag for Approved applications', () => {
    const futureDate = '2099-01-01';
    const futureEndDate = '2099-01-05';
    expect(computeEventTag(futureDate, futureEndDate, 'Approved')).toBe('Upcoming');

    const pastFromDate = '2020-01-01';
    const pastToDate = '2020-01-05';
    expect(computeEventTag(pastFromDate, pastToDate, 'Approved', [{ status: 'Pending Upload' }])).toBe('Action Required');
    expect(computeEventTag(pastFromDate, pastToDate, 'Approved', [{ status: 'Uploaded' }])).toBe('Reviewing');
    expect(computeEventTag(pastFromDate, pastToDate, 'Approved', [{ status: 'Verified' }])).toBe('Completed');
  });
});
