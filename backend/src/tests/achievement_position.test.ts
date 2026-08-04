import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../db';
import { users, faculty, students, odApplications, certificateRequirements } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { createApplication } from '../modules/applications/applications.service';
import { uploadCertificate } from '../modules/certificates/certificates.service';
import { isAchievementEligible } from '../modules/applications/applications.types';

const TEST_STUDENT_ID = 'TEST_ACHIEVE_STUDENT';
const TEST_MENTOR_ID = 'TEST_ACHIEVE_MENTOR';

describe('Achievement Position Integration Tests', () => {
  beforeAll(async () => {
    // Cleanup any leftovers
    const apps = await db.select({ id: odApplications.applicationId }).from(odApplications).where(eq(odApplications.studentId, TEST_STUDENT_ID));
    const appIds = apps.map((a) => a.id);
    if (appIds.length > 0) {
      await db.delete(certificateRequirements).where(inArray(certificateRequirements.applicationId, appIds));
      await db.delete(odApplications).where(inArray(odApplications.applicationId, appIds));
    }
    await db.delete(students).where(eq(students.userId, TEST_STUDENT_ID));
    await db.delete(faculty).where(eq(faculty.userId, TEST_MENTOR_ID));
    await db.delete(users).where(inArray(users.userId, [TEST_STUDENT_ID, TEST_MENTOR_ID]));

    // Seed test mentor & student
    await db.insert(users).values([
      {
        userId: TEST_MENTOR_ID,
        username: 'test_achieve_mentor',
        passwordHash: 'hash',
        role: 'Mentor',
      },
      {
        userId: TEST_STUDENT_ID,
        username: 'test_achieve_student',
        passwordHash: 'hash',
        role: 'Student',
      },
    ]);

    await db.insert(faculty).values({
      userId: TEST_MENTOR_ID,
      fullName: 'Achievement Test Mentor',
      designation: 'Assistant Professor',
    });

    await db.insert(students).values({
      userId: TEST_STUDENT_ID,
      mentorId: TEST_MENTOR_ID,
      fullName: 'Achievement Test Student',
      dateOfBirth: '2003-05-15',
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

  it('verifies eligibility helper correctly classifies activity types', () => {
    expect(isAchievementEligible('Co-curricular', 'Hackathon')).toBe(true);
    expect(isAchievementEligible('Co-curricular', 'Symposium')).toBe(true);
    expect(isAchievementEligible('Extracurricular', 'Sports')).toBe(true);

    expect(isAchievementEligible('Co-curricular', 'Workshop')).toBe(false);
    expect(isAchievementEligible('Co-curricular', 'Seminar')).toBe(false);
    expect(isAchievementEligible('Extracurricular', 'Dance')).toBe(false);
    expect(isAchievementEligible('Extracurricular', 'NSS')).toBe(false);
    expect(isAchievementEligible('Others', 'General')).toBe(false);
  });

  it('defaults achievement to Participation on application creation', async () => {
    const app = await createApplication(
      {
        title: 'Smart India Hackathon 2026',
        activityCategory: 'Co-curricular',
        activityType: 'Hackathon',
        institutionName: 'Tech Park',
        fromDate: '2026-08-10',
        toDate: '2026-08-12',
        numberOfEvents: 1,
      },
      TEST_STUDENT_ID
    );

    expect(app.achievement).toBe('Participation');
  });

  it('updates achievement position upon post-event certificate upload for eligible activity', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const app = await createApplication(
      {
        title: 'State Level Sports Meet 2026',
        activityCategory: 'Extracurricular',
        activityType: 'Sports',
        institutionName: 'Stadium',
        fromDate: todayStr,
        toDate: todayStr,
        numberOfEvents: 1,
      },
      TEST_STUDENT_ID
    );

    // Create a certificate requirement record for this app
    const [req] = await db
      .insert(certificateRequirements)
      .values({
        applicationId: app.applicationId,
        sequenceNumber: 1,
        activityCategory: 'Extracurricular',
        activityType: 'Sports',
        status: 'Pending Upload',
        submissionDeadline: '2026-12-31',
      })
      .returning();

    // Student uploads certificate and submits First Prize achievement position
    await uploadCertificate(
      TEST_STUDENT_ID,
      {
        requirementId: req.requirementId.toString(),
        fileUrl: 'http://example.com/cert.pdf',
        achievement: 'First Prize',
      }
    );

    const [dbApp] = await db
      .select()
      .from(odApplications)
      .where(eq(odApplications.applicationId, app.applicationId));

    expect(dbApp.achievement).toBe('First Prize');
  });
});
