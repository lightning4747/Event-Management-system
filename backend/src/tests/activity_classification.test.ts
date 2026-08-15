import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../db';
import { users, faculty, students, odApplications, certificateRequirements } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { createApplication } from '../modules/applications/applications.service';
import { createApplicationSchema } from '../modules/applications/applications.types';
import { generateGlobalReport } from '../modules/reports/reports.service';

const TEST_STUDENT_ID = 'TEST_ACT_STUDENT';
const TEST_MENTOR_ID = 'TEST_ACT_MENTOR';

describe('Activity Type Classification Feature', () => {
  beforeAll(async () => {
    // Cleanup any leftovers
    await db.delete(odApplications).where(eq(odApplications.studentId, TEST_STUDENT_ID));
    await db.delete(students).where(eq(students.userId, TEST_STUDENT_ID));
    await db.delete(faculty).where(eq(faculty.userId, TEST_MENTOR_ID));
    await db.delete(users).where(inArray(users.userId, [TEST_STUDENT_ID, TEST_MENTOR_ID]));

    // Seed test mentor & student
    await db.insert(users).values([
      {
        userId: TEST_MENTOR_ID,
        username: 'test_act_mentor',
        passwordHash: 'hash',
        role: 'Mentor',
      },
      {
        userId: TEST_STUDENT_ID,
        username: 'test_act_student',
        passwordHash: 'hash',
        role: 'Student',
      },
    ]);

    await db.insert(faculty).values({
      userId: TEST_MENTOR_ID,
      fullName: 'Activity Test Mentor',
      designation: 'Assistant Professor',
    });

    await db.insert(students).values({
      userId: TEST_STUDENT_ID,
      mentorId: TEST_MENTOR_ID,
      fullName: 'Activity Test Student',
      dateOfBirth: '2002-05-15',
      admissionYear: 2023,
      section: 'A',
    });
  });

  afterAll(async () => {
    const apps = await db.select({ id: odApplications.applicationId }).from(odApplications).where(eq(odApplications.studentId, TEST_STUDENT_ID));
    const appIds = apps.map((a) => a.id);
    if (appIds.length > 0) {
      await db.delete(certificateRequirements).where(inArray(certificateRequirements.applicationId, appIds));
      await db.delete(odApplications).where(inArray(odApplications.applicationId, appIds));
    }
    await db.delete(students).where(eq(students.userId, TEST_STUDENT_ID));
    await db.delete(faculty).where(eq(faculty.userId, TEST_MENTOR_ID));
    await db.delete(users).where(inArray(users.userId, [TEST_STUDENT_ID, TEST_MENTOR_ID]));
  });

  it('validates Extracurricular activity types using Zod schema', () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const dayAfterStr = dayAfter.toISOString().split('T')[0];

    const valid = createApplicationSchema.safeParse({
      title: 'Inter-College Football Tournament',
      activityCategory: 'Extracurricular',
      activityType: 'Sports',
      institutionName: 'Main Stadium',
      fromDate: tomorrowStr,
      toDate: dayAfterStr,
      numberOfEvents: 1,
    });
    expect(valid.success).toBe(true);

    const invalid = createApplicationSchema.safeParse({
      title: 'Invalid Extracurricular Type',
      activityCategory: 'Extracurricular',
      activityType: 'InvalidType',
      institutionName: 'Main Hall',
      fromDate: tomorrowStr,
      toDate: dayAfterStr,
      numberOfEvents: 1,
    });
    expect(invalid.success).toBe(false);
  });

  it('validates Co-curricular activity types using Zod schema', () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const dayAfterStr = dayAfter.toISOString().split('T')[0];

    const valid = createApplicationSchema.safeParse({
      title: 'National Level Hackathon 2026',
      activityCategory: 'Co-curricular',
      activityType: 'Hackathon',
      institutionName: 'Tech Park',
      fromDate: tomorrowStr,
      toDate: dayAfterStr,
      numberOfEvents: 1,
    });
    expect(valid.success).toBe(true);
  });

  it('creates an application with Activity Category and Activity Type', async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const dayAfterStr = dayAfter.toISOString().split('T')[0];

    const app = await createApplication(
      {
        title: 'Dance Performance Fest',
        activityCategory: 'Extracurricular',
        activityType: 'Dance',
        institutionName: 'Auditorium',
        fromDate: tomorrowStr,
        toDate: dayAfterStr,
        numberOfEvents: 1,
      },
      TEST_STUDENT_ID
    );

    expect(app.title).toBe('Dance Performance Fest');
    expect(app.activityCategory).toBe('Extracurricular');
    expect(app.activityType).toBe('Dance');

    // Update status to Approved for finished export test
    await db.update(odApplications).set({ status: 'Approved' }).where(eq(odApplications.applicationId, app.applicationId));
  });

  it('filters global CSV report by activityCategory and activityType', async () => {
    const csv = await generateGlobalReport({
      activityCategory: 'Extracurricular',
      activityType: 'Dance',
    });

    expect(csv).toContain('Type of the Event');
    expect(csv).toContain('Dance');
  });
});
