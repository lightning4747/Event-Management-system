import { describe, it, expect } from 'vitest';
import { db } from '../db';
import { users, students, faculty } from '../db/schema';
import { updateStudent } from '../modules/mentor/mentor.service';
import { updateFaculty } from '../modules/admin/admin.service';
import { eq } from 'drizzle-orm';
import { comparePassword } from '../utils/crypto';

describe('User Management Updates Integration Tests', () => {
  it('should allow mentor to update mentee details and reject updates for unauthorized mentor', async () => {
    const studentId = 'TEST_STUDENT_MGMT_01';
    const mentorId = 'MENTOR_01';
    const unauthorizedMentorId = 'MENTOR_02';

    // 1. Clean up student & ensure mentor exists
    await db.delete(students).where(eq(students.userId, studentId));
    await db.delete(users).where(eq(users.userId, studentId));

    const [existingMentor] = await db.select().from(users).where(eq(users.userId, mentorId));
    if (!existingMentor) {
      await db.insert(users).values({
        userId: mentorId,
        username: mentorId,
        role: 'Mentor',
        passwordHash: 'hash',
      });
      await db.insert(faculty).values({
        userId: mentorId,
        fullName: 'Assigned Mentor',
        designation: 'Assistant Professor',
      });
    }

    await db.insert(users).values({
      userId: studentId,
      username: studentId,
      role: 'Student',
      passwordHash: 'hash',
    });
    await db.insert(students).values({
      userId: studentId,
      mentorId,
      fullName: 'Original Student Name',
      dateOfBirth: '2003-01-01',
      admissionYear: 2023,
      section: 'A',
    });

    // 2. Reject update attempt by unauthorized mentor (MENTOR_02)
    await expect(
      updateStudent(studentId, { fullName: 'Hacked Name' }, unauthorizedMentorId)
    ).rejects.toThrow('Access Denied: You are not the assigned mentor for this student.');

    // 3. Allow update by assigned mentor (MENTOR_01)
    const updated = await updateStudent(
      studentId,
      { fullName: 'Updated Student Name', section: 'B', dateOfBirth: '2003-05-15' },
      mentorId
    );

    expect(updated.fullName).toBe('Updated Student Name');
    expect(updated.section).toBe('B');
    expect(updated.dateOfBirth).toBe('2003-05-15');

    // 4. Verify database state
    const [dbStudent] = await db
      .select()
      .from(students)
      .where(eq(students.userId, studentId));

    expect(dbStudent.fullName).toBe('Updated Student Name');
    expect(dbStudent.section).toBe('B');
    expect(dbStudent.dateOfBirth).toBe('2003-05-15');
  });

  it('should allow admin to update faculty details and password', async () => {
    const facultyId = 'TEST_FACULTY_MGMT_01';

    // 1. Clean up & insert faculty user
    await db.delete(users).where(eq(users.userId, facultyId));
    await db.insert(users).values({
      userId: facultyId,
      username: facultyId,
      role: 'Mentor',
      passwordHash: 'initialhash',
    });
    await db.insert(faculty).values({
      userId: facultyId,
      fullName: 'Original Faculty Name',
      designation: 'Assistant Professor',
    });

    // 2. Perform admin update
    const updated = await updateFaculty(facultyId, {
      fullName: 'Dr. Updated Faculty',
      designation: 'Associate Professor',
      role: 'Event Coordinator',
      password: 'newsecretpassword123',
    });

    expect(updated.fullName).toBe('Dr. Updated Faculty');
    expect(updated.designation).toBe('Associate Professor');
    expect(updated.role).toBe('Event Coordinator');

    // 3. Verify in database
    const [dbUser] = await db.select().from(users).where(eq(users.userId, facultyId));
    const [dbFaculty] = await db.select().from(faculty).where(eq(faculty.userId, facultyId));

    expect(dbFaculty.fullName).toBe('Dr. Updated Faculty');
    expect(dbFaculty.designation).toBe('Associate Professor');
    expect(dbUser.role).toBe('Event Coordinator');

    // Verify new password hash works
    const isPasswordValid = await comparePassword('newsecretpassword123', dbUser.passwordHash);
    expect(isPasswordValid).toBe(true);
  });
});
