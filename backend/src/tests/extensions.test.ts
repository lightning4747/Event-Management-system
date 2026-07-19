import { describe, it, expect, beforeEach } from 'vitest';
import { clearDatabase, seedTestUsers } from './setup';
import { createApplication } from '../modules/applications/applications.service';
import { createDeadlineExtension } from '../modules/extensions/extensions.service';
import { db } from '../db';
import { odApplications } from '../db/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '../lib/errors';

describe('OD Application Deadline Extension Guard Test', () => {
  beforeEach(async () => {
    await clearDatabase();
    await seedTestUsers();
  });

  it('should allow a single extension but reject subsequent extension requests with a 400 error', async () => {
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

    // 2. Grant first extension: Should succeed
    const firstExtensionInput = {
      applicationId: appId.toString(),
      newDeadline: '2026-10-25',
      reason: 'Physical certificates delay from the university board',
    };

    const firstResult = await createDeadlineExtension('MENTOR_01', firstExtensionInput);
    expect(firstResult.extensionId).toBeDefined();
    expect(firstResult.newDeadline).toBe('2026-10-25');

    // 3. Grant second extension: Should fail with 400
    const secondExtensionInput = {
      applicationId: appId.toString(),
      newDeadline: '2026-10-30',
      reason: 'Further delay on the board seal',
    };

    await expect(
      createDeadlineExtension('MENTOR_01', secondExtensionInput)
    ).rejects.toThrowError(
      new AppError(400, 'EXTENSION_ALREADY_GRANTED', 'An extension has already been granted for this application.')
    );
  });
});
