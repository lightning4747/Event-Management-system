import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../db';
import { users, faculty, students, odApplications, certificateRequirements } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { generateGlobalReport, generateCohortReport } from '../modules/reports/reports.service';

const TEST_STUDENT_ID = 'TEST_CSV_STUDENT';
const TEST_MENTOR_ID = 'TEST_CSV_MENTOR';

describe('CSV Export Column Format & Security Integration Tests', () => {
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
        username: 'test_csv_mentor',
        passwordHash: 'hash',
        role: 'Mentor',
      },
      {
        userId: TEST_STUDENT_ID,
        username: 'test_csv_student',
        passwordHash: 'hash',
        role: 'Student',
      },
    ]);

    await db.insert(faculty).values({
      userId: TEST_MENTOR_ID,
      fullName: 'CSV Test Mentor',
      designation: 'Assistant Professor',
    });

    await db.insert(students).values({
      userId: TEST_STUDENT_ID,
      mentorId: TEST_MENTOR_ID,
      fullName: 'CSV Test Student',
      dateOfBirth: '2004-05-15',
      admissionYear: 2024,
      section: 'A',
    });

    const [app] = await db
      .insert(odApplications)
      .values({
        studentId: TEST_STUDENT_ID,
        title: '=DANGEROUS_FORMULA()',
        activityCategory: 'Co-curricular',
        activityType: 'Hackathon',
        location: 'Tech Park Auditorium',
        fromDate: '2026-08-15',
        toDate: '2026-08-17',
        numberOfEvents: 1,
        status: 'Approved',
      })
      .returning();

    await db.insert(certificateRequirements).values({
      applicationId: app.applicationId,
      sequenceNumber: 1,
      activityCategory: 'Co-curricular',
      activityType: 'Hackathon',
      status: 'Verified',
      submissionDeadline: '2026-12-31',
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

  it('generates global report with exact required 8 columns in order for finished events', async () => {
    const csv = await generateGlobalReport({});
    const lines = csv.split('\n');
    expect(lines.length).toBeGreaterThan(1);

    const header = lines[0];
    expect(header).toBe('"S.No","Department","Academic Year","Name of the Student","Roll No","Name of the Event","Type of the Event","Date of Participation (DD-MM-YYYY)","Participation/achievement","Name of the award/ medal"');

    // Find row for TEST_STUDENT_ID
    const studentRow = lines.find((l) => l.includes('CSV Test Student'));
    expect(studentRow).toBeDefined();

    if (studentRow) {
      expect(studentRow).toContain('"AI&DS"');
      expect(studentRow).toContain('"2024-2025"');
      expect(studentRow).toContain('"CSV Test Student"');
      expect(studentRow).toContain('"TEST_CSV_STUDENT"');
      expect(studentRow).toContain('"Hackathon"');
      expect(studentRow).toContain('"15-08-2026 to 17-08-2026"');
      expect(studentRow).toContain('"Participation"');
      expect(studentRow).toContain('"Participation certificate"');
      // Verify CSV formula injection prevention (escaped with single quote)
      expect(studentRow).toContain('\'=DANGEROUS_FORMULA()');
    }
  });

  it('generates cohort report for assigned mentor with correct columns and data for finished events', async () => {
    const csv = await generateCohortReport(TEST_MENTOR_ID, {});
    const lines = csv.split('\n');
    expect(lines.length).toBeGreaterThan(1);

    const header = lines[0];
    expect(header).toBe('"S.No","Department","Academic Year","Name of the Student","Roll No","Name of the Event","Type of the Event","Date of Participation (DD-MM-YYYY)","Participation/achievement","Name of the award/ medal"');
    expect(csv).toContain('CSV Test Student');
  });
});
