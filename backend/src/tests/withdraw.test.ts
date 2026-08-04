import { describe, it, expect, beforeEach } from 'vitest';
import { clearDatabase, seedTestUsers } from './setup';
import { createApplication, withdrawApplication } from '../modules/applications/applications.service';
import { makeApprovalDecision } from '../modules/decisions/decisions.service';
import { db } from '../db';
import { odApplications, applicationApprovalHistory } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('OD Application Withdrawal Integration Tests', () => {
  beforeEach(async () => {
    await clearDatabase();
    await seedTestUsers();
  });

  it('should successfully allow a student to withdraw their own pending application and record history log', async () => {
    const appInput = {
      title: 'Vibrant Gujarat Hackathon',
      institutionName: 'Gujarat',
      fromDate: '2026-09-01',
      toDate: '2026-09-03',
      numberOfEvents: 2,
    };

    // 1. Submit application
    const appResult = await createApplication(appInput, 'STUDENT_01');
    const appId = appResult.applicationId;

    // 2. Withdraw application
    const withdrawResult = await withdrawApplication(appId, 'STUDENT_01');
    expect(withdrawResult.newStatus).toBe('Withdrawn');

    // 3. Verify status in DB
    const [updatedApp] = await db
      .select({ status: odApplications.status, withdrawnAt: odApplications.withdrawnAt })
      .from(odApplications)
      .where(eq(odApplications.applicationId, appId))
      .limit(1);

    expect(updatedApp.status).toBe('Withdrawn');
    expect(updatedApp.withdrawnAt).not.toBeNull();

    // 4. Verify history log
    const [historyRecord] = await db
      .select()
      .from(applicationApprovalHistory)
      .where(eq(applicationApprovalHistory.applicationId, appId))
      .limit(1);

    expect(historyRecord).toBeDefined();
    expect(historyRecord.decision).toBe('Withdraw');
    expect(historyRecord.approverId).toBe('STUDENT_01');
    expect(historyRecord.approverRole).toBe('Student');
  });

  it('should block withdrawal if the application is already approved/rejected (immutable)', async () => {
    const appInput = {
      title: 'Vibrant Gujarat Hackathon',
      institutionName: 'Gujarat',
      fromDate: '2026-09-01',
      toDate: '2026-09-03',
      numberOfEvents: 2,
    };

    const appResult = await createApplication(appInput, 'STUDENT_01');
    const appId = appResult.applicationId;

    // EC reviews & rejects it
    await makeApprovalDecision(appId, 'EC_01', 'Event Coordinator', {
      decision: 'Reject',
      comments: 'Incomplete documentation',
    });

    // Try to withdraw (should throw immutable error message)
    await expect(withdrawApplication(appId, 'STUDENT_01')).rejects.toThrow(/already decided/i);
  });

  it('should prevent other students from withdrawing an application they do not own', async () => {
    const appInput = {
      title: 'Vibrant Gujarat Hackathon',
      institutionName: 'Gujarat',
      fromDate: '2026-09-01',
      toDate: '2026-09-03',
      numberOfEvents: 2,
    };

    const appResult = await createApplication(appInput, 'STUDENT_01');
    const appId = appResult.applicationId;

    // STUDENT_02 (who does not own it) tries to withdraw
    await expect(withdrawApplication(appId, 'STUDENT_02')).rejects.toThrow(/Access Denied/i);
  });
});
