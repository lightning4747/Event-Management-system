import { describe, it, expect, beforeEach } from 'vitest';
import { clearDatabase, seedTestUsers } from './setup';
import { createApplication, getDepartmentApplications, getApplicationDetails } from '../modules/applications/applications.service';
import { makeApprovalDecision } from '../modules/decisions/decisions.service';
import { db } from '../db';
import { odApplications, certificateRequirements } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('OD Application Workflow Lifecycle Integration Test', () => {
  beforeEach(async () => {
    await clearDatabase();
    await seedTestUsers();
  });

  it('should successfully run the full multi-stage approval workflow from Student to HOD with strict stage-based visibility filters', async () => {
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

    // ── STAGE 1 VISIBILITY CHECKS (Pending at Event Coordinator) ──
    const ecApps1 = await getDepartmentApplications('Event Coordinator', 'EC_01');
    expect(ecApps1.some(a => a.applicationId === appId)).toBe(true);

    const mentorApps1 = await getDepartmentApplications('Mentor', 'MENTOR_01');
    expect(mentorApps1.some(a => a.applicationId === appId)).toBe(false);

    const pcApps1 = await getDepartmentApplications('Program Coordinator', 'PC_01');
    expect(pcApps1.some(a => a.applicationId === appId)).toBe(false);

    const hodApps1 = await getDepartmentApplications('Head of Department', 'HOD_01');
    expect(hodApps1.some(a => a.applicationId === appId)).toBe(false);

    // Detail fetch checks (must fail with Forbidden for Mentor, PC, and HOD)
    await expect(getApplicationDetails(appId, 'MENTOR_01', 'Mentor')).rejects.toThrow(/Access Denied/i);
    await expect(getApplicationDetails(appId, 'PC_01', 'Program Coordinator')).rejects.toThrow(/Access Denied/i);
    await expect(getApplicationDetails(appId, 'HOD_01', 'Head of Department')).rejects.toThrow(/Access Denied/i);

    // 2. Event Coordinator approves
    const ecDecision = await makeApprovalDecision(appId, 'EC_01', 'Event Coordinator', {
      decision: 'Approve',
      comments: 'Eligible student',
    });
    expect(ecDecision.newStatus).toBe('In Progress: Mentor');

    // ── STAGE 2 VISIBILITY CHECKS (Pending at Mentor) ──
    const ecApps2 = await getDepartmentApplications('Event Coordinator', 'EC_01');
    expect(ecApps2.some(a => a.applicationId === appId)).toBe(true); // EC can still see it in resolved

    const mentorApps2 = await getDepartmentApplications('Mentor', 'MENTOR_01');
    expect(mentorApps2.some(a => a.applicationId === appId)).toBe(true); // Mentor 1 can see it now

    const mentor2Apps2 = await getDepartmentApplications('Mentor', 'MENTOR_02');
    expect(mentor2Apps2.some(a => a.applicationId === appId)).toBe(false); // Mentor 2 cannot see (wrong cohort)

    const pcApps2 = await getDepartmentApplications('Program Coordinator', 'PC_01');
    expect(pcApps2.some(a => a.applicationId === appId)).toBe(false);

    const hodApps2 = await getDepartmentApplications('Head of Department', 'HOD_01');
    expect(hodApps2.some(a => a.applicationId === appId)).toBe(false);

    // Detail fetch checks
    await expect(getApplicationDetails(appId, 'MENTOR_02', 'Mentor')).rejects.toThrow(/Access Denied/i); // Wrong cohort
    await expect(getApplicationDetails(appId, 'PC_01', 'Program Coordinator')).rejects.toThrow(/Access Denied/i);
    await expect(getApplicationDetails(appId, 'HOD_01', 'Head of Department')).rejects.toThrow(/Access Denied/i);

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

    // ── STAGE 3 VISIBILITY CHECKS (Pending at Program Coordinator) ──
    const mentorApps3 = await getDepartmentApplications('Mentor', 'MENTOR_01');
    expect(mentorApps3.some(a => a.applicationId === appId)).toBe(true); // Mentor 1 can see history

    const pcApps3 = await getDepartmentApplications('Program Coordinator', 'PC_01');
    expect(pcApps3.some(a => a.applicationId === appId)).toBe(true); // PC can see now

    const hodApps3 = await getDepartmentApplications('Head of Department', 'HOD_01');
    expect(hodApps3.some(a => a.applicationId === appId)).toBe(false);

    // Detail fetch check
    await expect(getApplicationDetails(appId, 'HOD_01', 'Head of Department')).rejects.toThrow(/Access Denied/i);

    // 5. Program Coordinator approves
    const pcDecision = await makeApprovalDecision(appId, 'PC_01', 'Program Coordinator', {
      decision: 'Approve',
      comments: 'Clear to proceed',
    });
    expect(pcDecision.newStatus).toBe('In Progress: Head of Department');

    // ── STAGE 4 VISIBILITY CHECKS (Pending at Head of Department) ──
    const pcApps4 = await getDepartmentApplications('Program Coordinator', 'PC_01');
    expect(pcApps4.some(a => a.applicationId === appId)).toBe(true); // PC can see history

    const hodApps4 = await getDepartmentApplications('Head of Department', 'HOD_01');
    expect(hodApps4.some(a => a.applicationId === appId)).toBe(true); // HOD can see now

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

  it('should reject application creation when fromDate is in the past', async () => {
    const invalidInput = {
      title: 'Past Event Hackathon',
      location: 'Block A',
      fromDate: '2020-01-01',
      toDate: '2020-01-02',
      numberOfEvents: 1,
    };

    await expect(createApplication(invalidInput, 'STUDENT_01')).rejects.toThrow(
      'Event start date cannot be in the past.'
    );
  });

  it('should reject application creation when toDate is before fromDate', async () => {
    const invalidInput = {
      title: 'Invalid Date Range Event',
      location: 'Block B',
      fromDate: '2026-10-10',
      toDate: '2026-10-05',
      numberOfEvents: 1,
    };

    await expect(createApplication(invalidInput, 'STUDENT_01')).rejects.toThrow(
      'Event end date must be greater than or equal to the start date.'
    );
  });
});
