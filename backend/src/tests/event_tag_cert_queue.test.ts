import { describe, it, expect } from 'vitest';
import { db } from '../db';
import { users, students, odApplications, certificateRequirements } from '../db/schema';
import { getDepartmentApplications } from '../modules/applications/applications.service';
import { eq } from 'drizzle-orm';

describe('Event Tag & Department Applications Integration Tests', () => {
  it('should return eventTag for department applications when fetched by Event Coordinator', async () => {
    const studentId = 'TEST_STUDENT_TAG_01';

    // 1. Clean up
    await db.delete(users).where(eq(users.userId, studentId));

    // 2. Setup user and student
    await db.insert(users).values({
      userId: studentId,
      username: studentId,
      role: 'Student',
      passwordHash: 'hash',
    });
    await db.insert(students).values({
      userId: studentId,
      mentorId: 'MENTOR_01',
      fullName: 'Test Tag Student',
      dateOfBirth: '2003-01-01',
      admissionYear: 2023,
      section: 'A',
    });

    // 3. Create approved application in the past
    const [insertedApp] = await db
      .insert(odApplications)
      .values({
        studentId,
        title: 'Past Event for EC Tag Verification',
        institutionName: 'Chennai',
        fromDate: '2026-01-01',
        toDate: '2026-01-02',
        numberOfEvents: 1,
        status: 'Approved',
      })
      .returning();

    // 4. Create certificate requirement for the application
    await db.insert(certificateRequirements).values({
      applicationId: insertedApp.applicationId,
      sequenceNumber: 1,
      status: 'Verified',
      submissionDeadline: '2026-01-10',
    });

    // 5. Fetch department applications as Event Coordinator
    const deptApps = await getDepartmentApplications('Event Coordinator', 'EC_01');
    const targetApp = deptApps.find((a) => a.applicationId === insertedApp.applicationId);

    expect(targetApp).toBeDefined();
    expect(targetApp?.eventTag).toBe('Completed');
  });
});
