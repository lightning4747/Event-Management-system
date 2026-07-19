import { describe, it, expect, beforeEach } from 'vitest';
import { clearDatabase, seedTestUsers } from './setup';
import { createApplication } from '../modules/applications/applications.service';
import { makeApprovalDecision } from '../modules/decisions/decisions.service';
import { db } from '../db';
import { odApplications, certificateRequirements } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('OD Application Workflow Lifecycle Integration Test', () => {
  beforeEach(async () => {
    await clearDatabase();
    await seedTestUsers();
  });

  it('should successfully run the full multi-stage approval workflow from Student to HOD', async () => {
    // 1. Student submits application
    const appInput = {
      title: 'Vibrant Gujarat Hackathon',
      location: 'Gujarat',
      fromDate: '2026-09-01',
      toDate: '2026-09-03',
      numberOfEvents: 2,
    };

    const studentId = 'STUDENT_01';
    const appResult = await createApplication(appInput, studentId);

    expect(appResult.applicationId).toBeDefined();
    expect(appResult.status).toBe('In Progress: Event Coordinator');

    const appId = appResult.applicationId;

    // 2. Event Coordinator approves
    const ecDecision = await makeApprovalDecision(appId, 'EC_01', 'Event Coordinator', {
      decision: 'Approve',
      comments: 'Eligible student',
    });
    expect(ecDecision.newStatus).toBe('In Progress: Mentor');

    // 3. Cohort Guard validation: Mentor 2 (wrong mentor) attempts to decide
    await expect(
      makeApprovalDecision(appId, 'MENTOR_02', 'Mentor', {
        decision: 'Approve',
        comments: 'Wrong mentor approve',
      })
    ).rejects.toThrow(/Access Denied/i);

    // 4. Correct Mentor approves
    const mentorDecision = await makeApprovalDecision(appId, 'MENTOR_01', 'Mentor', {
      decision: 'Approve',
      comments: 'Mentees academic standing is good',
    });
    expect(mentorDecision.newStatus).toBe('In Progress: Program Coordinator');

    // 5. Program Coordinator approves
    const pcDecision = await makeApprovalDecision(appId, 'PC_01', 'Program Coordinator', {
      decision: 'Approve',
      comments: 'Clear to proceed',
    });
    expect(pcDecision.newStatus).toBe('In Progress: Head of Department');

    // 6. Head of Department final sign-off
    const hodDecision = await makeApprovalDecision(appId, 'HOD_01', 'Head of Department', {
      decision: 'Approve',
      comments: 'Recommended and Approved',
    });
    expect(hodDecision.newStatus).toBe('Approved');

    // 7. Verify DB side effects (finalApprovedAt set, certificate requirements created)
    const [updatedApp] = await db
      .select()
      .from(odApplications)
      .where(eq(odApplications.applicationId, appId))
      .limit(1);

    expect(updatedApp.finalApprovedAt).not.toBeNull();

    // Verify certificate requirements
    const certReqs = await db
      .select()
      .from(certificateRequirements)
      .where(eq(certificateRequirements.applicationId, appId));

    expect(certReqs.length).toBe(2); // numberOfEvents = 2
    expect(certReqs[0].status).toBe('Pending Upload');
    expect(certReqs[0].sequenceNumber).toBe(1);
    expect(certReqs[1].sequenceNumber).toBe(2);

    // Verify submission deadline logic (toDate = 2026-09-03 + 7 days = 2026-09-10)
    expect(certReqs[0].submissionDeadline).toBe('2026-09-10');
  });
});
