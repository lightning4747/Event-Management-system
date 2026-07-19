import { describe, it, expect, beforeEach } from 'vitest';
import { clearDatabase, seedTestUsers } from './setup';
import { createApplication, checkApplicationImmutability } from '../modules/applications/applications.service';
import { db } from '../db';
import { odApplications } from '../db/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '../lib/errors';

describe('OD Application Immutability Enforcement Test', () => {
  beforeEach(async () => {
    await clearDatabase();
    await seedTestUsers();
  });

  it('should allow check to pass for in-progress applications but throw 400 for decided (Approved/Rejected) applications', async () => {
    // 1. Submit a fresh application (starts as 'In Progress: Event Coordinator')
    const appResult = await createApplication(
      {
        title: 'Smart India Hackathon 2026',
        location: 'Coimbatore',
        fromDate: '2026-10-01',
        toDate: '2026-10-03',
        numberOfEvents: 1,
      },
      'STUDENT_01'
    );

    const appId = appResult.applicationId;

    // A. In Progress: Should NOT throw
    await expect(checkApplicationImmutability(appId)).resolves.not.toThrow();

    // B. Approved: Should throw 400 APPLICATION_IMMUTABLE
    await db
      .update(odApplications)
      .set({ status: 'Approved' })
      .where(eq(odApplications.applicationId, appId));

    await expect(checkApplicationImmutability(appId)).rejects.toThrowError(
      new AppError(400, 'APPLICATION_IMMUTABLE', 'This On-Duty application has already been decided and is immutable.')
    );

    // C. Rejected: Should throw 400 APPLICATION_IMMUTABLE
    await db
      .update(odApplications)
      .set({ status: 'Rejected' })
      .where(eq(odApplications.applicationId, appId));

    await expect(checkApplicationImmutability(appId)).rejects.toThrowError(
      new AppError(400, 'APPLICATION_IMMUTABLE', 'This On-Duty application has already been decided and is immutable.')
    );
  });
});
