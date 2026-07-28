import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../db';
import { users, faculty, students, odApplications, certificateRequirements, certificates, applicationApprovalHistory } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { createApplication, getDepartmentApplications } from '../modules/applications/applications.service';
import { makeApprovalDecision } from '../modules/decisions/decisions.service';
import { uploadCertificate } from '../modules/certificates/certificates.service';

const TEST_STU = 'TEST_ROUTE_STU';
const TEST_EC = 'TEST_ROUTE_EC';
const TEST_MENTOR = 'TEST_ROUTE_MENTOR';
const TEST_PC = 'TEST_ROUTE_PC';
const TEST_HOD = 'TEST_ROUTE_HOD';

describe('Certificate Verification Routing Integration Tests', () => {
  beforeAll(async () => {
    // Cleanup
    await db.delete(odApplications).where(eq(odApplications.studentId, TEST_STU));
    await db.delete(students).where(eq(students.userId, TEST_STU));
    await db.delete(faculty).where(inArray(faculty.userId, [TEST_EC, TEST_MENTOR, TEST_PC, TEST_HOD]));
    await db.delete(users).where(inArray(users.userId, [TEST_STU, TEST_EC, TEST_MENTOR, TEST_PC, TEST_HOD]));

    await db.insert(users).values([
      { userId: TEST_EC, username: 'test_route_ec', passwordHash: 'hash', role: 'Event Coordinator' },
      { userId: TEST_MENTOR, username: 'test_route_mentor', passwordHash: 'hash', role: 'Mentor' },
      { userId: TEST_PC, username: 'test_route_pc', passwordHash: 'hash', role: 'Program Coordinator' },
      { userId: TEST_HOD, username: 'test_route_hod', passwordHash: 'hash', role: 'Head of Department' },
      { userId: TEST_STU, username: 'test_route_stu', passwordHash: 'hash', role: 'Student' },
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
      fullName: 'Test Route Student',
      dateOfBirth: '2003-01-01',
      admissionYear: 2023,
      section: 'A',
    });
  });

  afterAll(async () => {
    const apps = await db.select({ id: odApplications.applicationId }).from(odApplications).where(eq(odApplications.studentId, TEST_STU));
    const appIds = apps.map((a) => a.id);
    if (appIds.length > 0) {
      const reqs = await db.select({ id: certificateRequirements.requirementId }).from(certificateRequirements).where(inArray(certificateRequirements.applicationId, appIds));
      const reqIds = reqs.map((r) => r.id);
      if (reqIds.length > 0) {
        await db.delete(certificates).where(inArray(certificates.requirementId, reqIds));
      }
      await db.delete(certificateRequirements).where(inArray(certificateRequirements.applicationId, appIds));
      await db.delete(applicationApprovalHistory).where(inArray(applicationApprovalHistory.applicationId, appIds));
      await db.delete(odApplications).where(inArray(odApplications.applicationId, appIds));
    }
    await db.delete(students).where(eq(students.userId, TEST_STU));
    await db.delete(faculty).where(inArray(faculty.userId, [TEST_EC, TEST_MENTOR, TEST_PC, TEST_HOD]));
    await db.delete(users).where(inArray(users.userId, [TEST_STU, TEST_EC, TEST_MENTOR, TEST_PC, TEST_HOD]));
  });

  it('routes application to Reviewing state for Event Coordinator immediately upon certificate upload', async () => {
    const today = new Date().toISOString().split('T')[0];
    const created = await createApplication(
      {
        title: 'Hackathon 2026',
        numberOfEvents: 1,
        fromDate: today,
        toDate: today,
        location: 'Main Block',
        events: [{ sequenceNumber: 1, activityCategory: 'Co-curricular', activityType: 'Hackathon' }],
      },
      TEST_STU
    );

    const appId = created.applicationId;

    // Approvals
    await makeApprovalDecision(appId, TEST_EC, 'Event Coordinator', { decision: 'Approve' });
    await makeApprovalDecision(appId, TEST_MENTOR, 'Mentor', { decision: 'Approve' });
    await makeApprovalDecision(appId, TEST_PC, 'Program Coordinator', { decision: 'Approve' });
    await makeApprovalDecision(appId, TEST_HOD, 'Head of Department', { decision: 'Approve' });

    // Fetch requirements to get requirementId
    const [req] = await db.select().from(certificateRequirements).where(eq(certificateRequirements.applicationId, appId));

    // Student uploads certificate
    await uploadCertificate(
      TEST_STU,
      { requirementId: String(req.requirementId), fileUrl: '/uploads/test_cert.pdf' }
    );

    // EC fetches department applications
    const apps = await getDepartmentApplications('Event Coordinator', TEST_EC);
    const targetApp = apps.find((a) => String(a.applicationId) === String(appId));

    expect(targetApp).toBeDefined();
    expect(targetApp?.eventTag).toBe('Reviewing');
  });
});
