import { db } from '../db';
import { sql } from 'drizzle-orm';
import { users, faculty, students } from '../db/schema';

export const clearDatabase = async () => {
  await db.execute(sql`
    TRUNCATE TABLE 
      certificate_deadline_extensions,
      certificates,
      certificate_requirements,
      application_approval_history,
      od_applications,
      students,
      faculty,
      users
    CASCADE;
  `);
};

export const seedTestUsers = async () => {
  // 1. Insert Users
  await db.insert(users).values([
    { userId: 'STUDENT_01', username: 'student1', passwordHash: 'dummy', role: 'Student' },
    { userId: 'STUDENT_02', username: 'student2', passwordHash: 'dummy', role: 'Student' },
    { userId: 'MENTOR_01', username: 'mentor1', passwordHash: 'dummy', role: 'Mentor' },
    { userId: 'MENTOR_02', username: 'mentor2', passwordHash: 'dummy', role: 'Mentor' },
    { userId: 'EC_01', username: 'ec1', passwordHash: 'dummy', role: 'Event Coordinator' },
    { userId: 'PC_01', username: 'pc1', passwordHash: 'dummy', role: 'Program Coordinator' },
    { userId: 'HOD_01', username: 'hod1', passwordHash: 'dummy', role: 'Head of Department' },
  ]);

  // 2. Insert Faculty details
  await db.insert(faculty).values([
    { userId: 'MENTOR_01', fullName: 'Mentor One', designation: 'AP' },
    { userId: 'MENTOR_02', fullName: 'Mentor Two', designation: 'AP' },
    { userId: 'EC_01', fullName: 'EC One', designation: 'AP' },
    { userId: 'PC_01', fullName: 'PC One', designation: 'AP' },
    { userId: 'HOD_01', fullName: 'HOD One', designation: 'Professor' },
  ]);

  // 3. Insert Student details (Student 1 belongs to Mentor 1, Student 2 belongs to Mentor 2)
  await db.insert(students).values([
    { userId: 'STUDENT_01', mentorId: 'MENTOR_01', fullName: 'Student One', dateOfBirth: '2005-01-01', admissionYear: 2023, section: 'A' },
    { userId: 'STUDENT_02', mentorId: 'MENTOR_02', fullName: 'Student Two', dateOfBirth: '2005-02-02', admissionYear: 2023, section: 'B' },
  ]);
};
