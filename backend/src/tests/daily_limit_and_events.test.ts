import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { users, students, faculty, odApplications } from '../db/schema';
import { createApplication } from '../modules/applications/applications.service';
import { getStudentDashboardMetrics } from '../modules/dashboards/dashboards.service';
import { eq } from 'drizzle-orm';
import { AppError } from '../lib/errors';

describe('Daily Application Limit & Number of Events Range Validation', () => {
  const mentorId = 'LIMIT_MENTOR_01';
  const studentId = 'LIMIT_STUDENT_01';

  beforeEach(async () => {
    // Clean existing test data
    await db.delete(odApplications).where(eq(odApplications.studentId, studentId));
    await db.delete(students).where(eq(students.userId, studentId));
    await db.delete(faculty).where(eq(faculty.userId, mentorId));
    await db.delete(users).where(eq(users.userId, mentorId));
    await db.delete(users).where(eq(users.userId, studentId));

    // Create mentor user & record
    await db.insert(users).values({
      userId: mentorId,
      username: 'limit_mentor_01',
      passwordHash: 'hash',
      role: 'Mentor',
    });
    await db.insert(faculty).values({
      userId: mentorId,
      fullName: 'Limit Test Mentor',
      designation: 'Assistant Professor',
    });

    // Create student user & record
    await db.insert(users).values({
      userId: studentId,
      username: 'limit_student_01',
      passwordHash: 'hash',
      role: 'Student',
    });
    await db.insert(students).values({
      userId: studentId,
      mentorId,
      fullName: 'Limit Test Student',
      dateOfBirth: '2004-05-15',
      admissionYear: 2022,
      section: 'A',
    });
  });

  it('should reject application creation when numberOfEvents is 0 (outside 1-4 range)', async () => {
    await expect(
      createApplication(
        {
          title: 'Invalid 0 Events',
          location: 'College Campus',
          fromDate: '2026-08-10',
          toDate: '2026-08-12',
          numberOfEvents: 0,
          events: [],
        },
        studentId
      )
    ).rejects.toThrow(AppError);
  });

  it('should reject application creation when numberOfEvents is 5 (outside 1-4 range)', async () => {
    await expect(
      createApplication(
        {
          title: 'Invalid 5 Events',
          location: 'College Campus',
          fromDate: '2026-08-10',
          toDate: '2026-08-12',
          numberOfEvents: 5,
          events: Array.from({ length: 5 }).map((_, i) => ({
            sequenceNumber: i + 1,
            activityCategory: 'Co-curricular',
            activityType: 'Hackathon',
          })),
        },
        studentId
      )
    ).rejects.toThrow(AppError);
  });

  it('should reject application creation when events array length does not match numberOfEvents', async () => {
    await expect(
      createApplication(
        {
          title: 'Mismatched Events Length',
          location: 'College Campus',
          fromDate: '2026-08-10',
          toDate: '2026-08-12',
          numberOfEvents: 3,
          events: [
            { sequenceNumber: 1, activityCategory: 'Co-curricular', activityType: 'Hackathon' },
          ],
        },
        studentId
      )
    ).rejects.toThrow(AppError);
  });

  it('should allow creating up to 3 valid applications per day', async () => {
    for (let i = 1; i <= 3; i++) {
      const inserted = await createApplication(
        {
          title: `Daily App ${i}`,
          location: 'Main Auditorium',
          fromDate: '2026-08-15',
          toDate: '2026-08-16',
          numberOfEvents: 2,
          events: [
            { sequenceNumber: 1, activityCategory: 'Co-curricular', activityType: 'Hackathon' },
            { sequenceNumber: 2, activityCategory: 'Extracurricular', activityType: 'Sports' },
          ],
        },
        studentId
      );
      expect(inserted.applicationId).toBeDefined();
    }

    const metrics = await getStudentDashboardMetrics(studentId);
    expect(metrics.applicationsRemainingToday).toBe(0);
    expect(metrics.maxDailyApplications).toBe(3);
    expect(metrics.dailyLimitReached).toBe(true);
  });

  it('should throw DAILY_LIMIT_EXCEEDED when attempting a 4th application on the same day', async () => {
    for (let i = 1; i <= 3; i++) {
      await createApplication(
        {
          title: `Daily App ${i}`,
          location: 'Main Auditorium',
          fromDate: '2026-08-15',
          toDate: '2026-08-16',
          numberOfEvents: 1,
          events: [
            { sequenceNumber: 1, activityCategory: 'Co-curricular', activityType: 'Hackathon' },
          ],
        },
        studentId
      );
    }

    try {
      await createApplication(
        {
          title: 'Excess 4th Application',
          location: 'Main Auditorium',
          fromDate: '2026-08-15',
          toDate: '2026-08-16',
          numberOfEvents: 1,
          events: [
            { sequenceNumber: 1, activityCategory: 'Co-curricular', activityType: 'Hackathon' },
          ],
        },
        studentId
      );
      expect.unreachable('Should have thrown DAILY_LIMIT_EXCEEDED error');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('DAILY_LIMIT_EXCEEDED');
      expect((err as AppError).statusCode).toBe(400);
    }
  });
});
