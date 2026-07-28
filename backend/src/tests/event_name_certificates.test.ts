import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../db';
import { users, faculty, students, odApplications, certificateRequirements, applicationApprovalHistory } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { createApplication, getApplicationDetails } from '../modules/applications/applications.service';
import { makeApprovalDecision } from '../modules/decisions/decisions.service';

const TEST_STU = 'TEST_NAMED_STU';
const TEST_EC = 'TEST_NAMED_EC';
const TEST_MENTOR = 'TEST_NAMED_MENTOR';
const TEST_PC = 'TEST_NAMED_PC';
const TEST_HOD = 'TEST_NAMED_HOD';

describe('Event-Named Certificates & Faculty Event Type Visibility', () => {
  beforeAll(async () => {
    // Cleanup
    await db.delete(odApplications).where(eq(odApplications.studentId, TEST_STU));
    await db.delete(students).where(eq(students.userId, TEST_STU));
    await db.delete(faculty).where(inArray(faculty.userId, [TEST_EC, TEST_MENTOR, TEST_PC, TEST_HOD]));
    await db.delete(users).where(inArray(users.userId, [TEST_STU, TEST_EC, TEST_MENTOR, TEST_PC, TEST_HOD]));

    await db.insert(users).values([
      { userId: TEST_EC, username: 'test_named_ec', passwordHash: 'hash', role: 'Event Coordinator' },
      { userId: TEST_MENTOR, username: 'test_named_mentor', passwordHash: 'hash', role: 'Mentor' },
      { userId: TEST_PC, username: 'test_named_pc', passwordHash: 'hash', role: 'Program Coordinator' },
      { userId: TEST_HOD, username: 'test_named_hod', passwordHash: 'hash', role: 'Head of Department' },
      { userId: TEST_STU, username: 'test_named_stu', passwordHash: 'hash', role: 'Student' },
    ]);

    await db.insert(faculty).values([
      { userId: TEST_EC, fullName: 'EC User', designation: 'Assistant Professor' },
      { userId: TEST_MENTOR, fullName: 'Mentor User', designation: 'Assistant Professor' },
      { userId: TEST_PC, fullName: 'PC User', designation: 'Professor' },
      { userId: TEST_HOD, fullName: 'HOD User', designation: 'HOD' },
    ]);

    await db.insert(students).values({
      userId: TEST_STU,
      mentorId: TEST_MENTOR,
      fullName: 'Test Named Student',
      dateOfBirth: '2003-01-01',
      admissionYear: 2023,
      section: 'A',
    });
  });

  afterAll(async () => {
    const apps = await db.select({ id: odApplications.applicationId }).from(odApplications).where(eq(odApplications.studentId, TEST_STU));
    const appIds = apps.map((a) => a.id);
    if (appIds.length > 0) {
      await db.delete(certificateRequirements).where(inArray(certificateRequirements.applicationId, appIds));
      await db.delete(applicationApprovalHistory).where(inArray(applicationApprovalHistory.applicationId, appIds));
      await db.delete(odApplications).where(inArray(odApplications.applicationId, appIds));
    }
    await db.delete(students).where(eq(students.userId, TEST_STU));
    await db.delete(faculty).where(inArray(faculty.userId, [TEST_EC, TEST_MENTOR, TEST_PC, TEST_HOD]));
    await db.delete(users).where(inArray(users.userId, [TEST_STU, TEST_EC, TEST_MENTOR, TEST_PC, TEST_HOD]));
  });

  it('attaches event activity types to certificate requirements upon approval', async () => {
    const today = new Date().toISOString().split('T')[0];
    const created = await createApplication(
      {
        title: 'Multi Event Fest 2026',
        numberOfEvents: 2,
        fromDate: today,
        toDate: today,
        location: 'Campus',
        events: [
          { sequenceNumber: 1, activityCategory: 'Co-curricular', activityType: 'Hackathon' },
          { sequenceNumber: 2, activityCategory: 'Extracurricular', activityType: 'Sports' },
        ],
      },
      TEST_STU
    );

    const appId = created.applicationId;

    // Approve through all stages
    await makeApprovalDecision(appId, TEST_EC, 'Event Coordinator', { decision: 'Approve' });
    await makeApprovalDecision(appId, TEST_MENTOR, 'Mentor', { decision: 'Approve' });
    await makeApprovalDecision(appId, TEST_PC, 'Program Coordinator', { decision: 'Approve' });
    await makeApprovalDecision(appId, TEST_HOD, 'Head of Department', { decision: 'Approve' });

    // Fetch application details as Student
    const details = await getApplicationDetails(appId, 'Student', TEST_STU);

    expect(details.certificates).toHaveLength(2);
    expect(details.certificates[0].activityType).toBe('Hackathon');
    expect(details.certificates[1].activityType).toBe('Sports');
    expect(details.application.events).toHaveLength(2);
  });
});
