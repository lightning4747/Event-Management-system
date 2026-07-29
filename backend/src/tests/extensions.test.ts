import { describe, it, expect, beforeEach } from 'vitest';
import { clearDatabase, seedTestUsers } from './setup';
import { createApplication } from '../modules/applications/applications.service';
import { requestDeadlineExtension, decideDeadlineExtension } from '../modules/extensions/extensions.service';
import { db } from '../db';
import { odApplications } from '../db/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '../lib/errors';

describe('OD Application Deadline Extension Pipeline Test', () => {
  beforeEach(async () => {
    await clearDatabase();
    await seedTestUsers();
  });

  it('should allow student to request an extension, EC to approve it, and prevent duplicate requests', async () => {
    // 1. Submit application
    const appResult = await createApplication(
      {
        title: 'National SIH Hackathon 2026',
        location: 'Trichy',
        fromDate: '2026-10-15',
        toDate: '2026-10-17',
        numberOfEvents: 1,
      },
      'STUDENT_01'
    );

    const appId = appResult.applicationId;

    // Approve the application status directly to allow extensions
    await db
      .update(odApplications)
      .set({ status: 'Approved' })
      .where(eq(odApplications.applicationId, appId));

    // 2. Student requests extension (3 days)
    const requestInput = {
      applicationId: appId.toString(),
      requestedDays: 3,
      reason: 'Physical certificates delay from the university board',
    };

    const firstResult = await requestDeadlineExtension('STUDENT_01', requestInput);
    expect(firstResult.extensionId).toBeDefined();
    expect(firstResult.requestedDays).toBe(3);

    // 3. Second request from student while pending: Should fail with 400
    await expect(
      requestDeadlineExtension('STUDENT_01', requestInput)
    ).rejects.toThrowError(
      new AppError(400, 'EXTENSION_EXISTS', 'An extension request is already pending event coordinator review.')
    );

    // 4. Event Coordinator approves extension
    const decisionResult = await decideDeadlineExtension('EC_01', firstResult.extensionId, {
      decision: 'Approve',
    });
    expect(decisionResult.status).toBe('Approved');
    expect(decisionResult.newDeadline).toBeDefined();

    // 5. Subsequent request after approval: Should fail with 400
    await expect(
      requestDeadlineExtension('STUDENT_01', requestInput)
    ).rejects.toThrowError(
      new AppError(400, 'EXTENSION_EXISTS', 'An extension has already been granted for this application.')
    );
  });
});
