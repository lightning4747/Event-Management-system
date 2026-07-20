import { describe, it, expect, beforeEach } from 'vitest';
import { clearDatabase, seedTestUsers } from './setup';
import { getAllStudents, getStudentCompleteRecord } from '../modules/students/students.service';

describe('Student Directory Cohort Isolation Integration Tests', () => {
  beforeEach(async () => {
    await clearDatabase();
    await seedTestUsers();
  });

  it('should only return cohort mentees for Mentors in getAllStudents listing', async () => {
    // MENTOR_01 cohort: STUDENT_01 has mentorId = MENTOR_01
    // MENTOR_02 cohort: STUDENT_02 has mentorId = MENTOR_02
    
    // Querying as MENTOR_01
    const listMentor1 = await getAllStudents(undefined, undefined, 'MENTOR_01');
    expect(listMentor1.length).toBe(1);
    expect(listMentor1[0].userId).toBe('STUDENT_01');

    // Querying as MENTOR_02
    const listMentor2 = await getAllStudents(undefined, undefined, 'MENTOR_02');
    expect(listMentor2.length).toBe(1);
    expect(listMentor2[0].userId).toBe('STUDENT_02');

    // Querying as non-mentor (e.g. HOD or Admin) passes undefined mentorId, returning both students
    const listAll = await getAllStudents();
    expect(listAll.length).toBe(2);
    expect(listAll.some(s => s.userId === 'STUDENT_01')).toBe(true);
    expect(listAll.some(s => s.userId === 'STUDENT_02')).toBe(true);
  });

  it('should block Mentors from retrieving complete records of students outside their cohort', async () => {
    // MENTOR_01 can access STUDENT_01 (their cohort)
    const detailsOwn = await getStudentCompleteRecord('STUDENT_01', 'Mentor', 'MENTOR_01');
    expect(detailsOwn.student.userId).toBe('STUDENT_01');

    // MENTOR_01 cannot access STUDENT_02 (different cohort)
    await expect(
      getStudentCompleteRecord('STUDENT_02', 'Mentor', 'MENTOR_01')
    ).rejects.toThrow(/Access Denied/i);
  });

  it('should allow other department roles (e.g. EC, PC, HOD) to access any student records', async () => {
    // EC_01 can access STUDENT_01
    const detailsEC = await getStudentCompleteRecord('STUDENT_01', 'Event Coordinator', 'EC_01');
    expect(detailsEC.student.userId).toBe('STUDENT_01');

    // HOD_01 can access STUDENT_02
    const detailsHOD = await getStudentCompleteRecord('STUDENT_02', 'Head of Department', 'HOD_01');
    expect(detailsHOD.student.userId).toBe('STUDENT_02');
  });
});
