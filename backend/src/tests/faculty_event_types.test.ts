import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../db';
import { users, faculty, students, odApplications } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { createApplication, getDepartmentApplications } from '../modules/applications/applications.service';

describe('Faculty Event Types Integration Tests', () => {
  const TEST_STU = 'STU_EVT_01';
  const TEST_FAC = 'FAC_EVT_01';

  beforeAll(async () => {
    // Clean up
    const apps = await db.select({ id: odApplications.applicationId }).from(odApplications).where(eq(odApplications.studentId, TEST_STU));
    const appIds = apps.map((a) => a.id);
    if (appIds.length > 0) {
      await db.delete(odApplications).where(inArray(odApplications.applicationId, appIds));
    }
    await db.delete(students).where(eq(students.userId, TEST_STU));
    await db.delete(faculty).where(eq(faculty.userId, TEST_FAC));
    await db.delete(users).where(inArray(users.userId, [TEST_STU, TEST_FAC]));

    // Insert Faculty (Mentor) first (due to FK constraint)
    await db.insert(users).values({
      userId: TEST_FAC,
      username: TEST_FAC,
      passwordHash: 'hashed_pw',
      role: 'Mentor',
    });
    await db.insert(faculty).values({
      userId: TEST_FAC,
      fullName: 'Mentor Evt Test',
      designation: 'Assistant Professor',
    });

    // Insert Student
    await db.insert(users).values({
      userId: TEST_STU,
      username: TEST_STU,
      passwordHash: 'hashed_pw',
      role: 'Student',
    });
    await db.insert(students).values({
      userId: TEST_STU,
      fullName: 'Event Test Student',
      mentorId: TEST_FAC,
      section: 'A',
      admissionYear: 2024,
      dateOfBirth: '2004-01-01',
    });
  });

  afterAll(async () => {
    const apps = await db.select({ id: odApplications.applicationId }).from(odApplications).where(eq(odApplications.studentId, TEST_STU));
    const appIds = apps.map((a) => a.id);
    if (appIds.length > 0) {
      await db.delete(odApplications).where(inArray(odApplications.applicationId, appIds));
    }
    await db.delete(students).where(eq(students.userId, TEST_STU));
    await db.delete(faculty).where(eq(faculty.userId, TEST_FAC));
    await db.delete(users).where(inArray(users.userId, [TEST_STU, TEST_FAC]));
  });

  it('returns events array and activity types in getDepartmentApplications for faculty', async () => {
    const today = new Date().toISOString().split('T')[0];
    const created = await createApplication(
      {
        title: 'Multi-Event Symposium',
        numberOfEvents: 2,
        fromDate: today,
        toDate: today,
        location: 'Auditorium',
        events: [
          { sequenceNumber: 1, activityCategory: 'Co-curricular', activityType: 'Symposium' },
          { sequenceNumber: 2, activityCategory: 'Extracurricular', activityType: 'Sports' },
        ],
      },
      TEST_STU
    );

    const apps = await getDepartmentApplications('Event Coordinator', TEST_FAC);
    const target = apps.find((a) => String(a.applicationId) === String(created.applicationId));

    expect(target).toBeDefined();
    expect(target?.events).toBeDefined();
    expect(target?.events?.length).toBe(2);
    expect(target?.events?.[0].activityType).toBe('Symposium');
    expect(target?.events?.[1].activityType).toBe('Sports');
  });
});
