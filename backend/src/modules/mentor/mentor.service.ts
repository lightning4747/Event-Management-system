import { db } from '../../db';
import { users, students } from '../../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { hashPassword } from '../../utils/crypto';
import { AppError } from '../../lib/errors';
import { CreateStudentInput } from './mentor.types';

const parseAdmissionYear = (userId: string): number => {
  // Roll number format e.g. 727624BAD115
  // We ignore the college code (first 4 digits "7276") and extract the next 2 digits "24"
  if (userId.length >= 6) {
    const yearStr = userId.substring(4, 6);
    const yearNum = parseInt(yearStr);
    if (!isNaN(yearNum)) {
      return 2000 + yearNum;
    }
  }
  throw new AppError(400, 'INVALID_REGISTER_NUMBER', 'Failed to extract Admission Year from Register Number. Ensure it is in the correct format (e.g. 727624BAD001).');
};

export const createStudent = async (
  input: CreateStudentInput,
  mentorUserId: string
): Promise<{ userId: string; username: string; fullName: string; role: string }> => {
  const cleanUserId = input.userId.trim().toUpperCase();

  // Parse admission year from roll number
  const admissionYear = parseAdmissionYear(cleanUserId);

  // Validate admission year is not in the future
  const currentYear = new Date().getFullYear();
  if (admissionYear > currentYear) {
    throw new AppError(400, 'INVALID_ADMISSION_YEAR', `Admission year ${admissionYear} cannot be in the future.`);
  }

  // Check if userId already exists
  const [existingUserById] = await db
    .select()
    .from(users)
    .where(eq(users.userId, cleanUserId))
    .limit(1);

  if (existingUserById) {
    throw new AppError(400, 'USER_EXISTS', 'A student with this Register Number already exists.');
  }

  const dobParts = input.dateOfBirth.split('-');
  const dobPassword = `${dobParts[2]}${dobParts[1]}${dobParts[0]}`;
  const passwordHash = await hashPassword(dobPassword);

  try {
    // Run in a database transaction to ensure atomicity
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        userId: cleanUserId,
        username: cleanUserId, // concept of username removed: set identical to userId
        passwordHash,
        role: 'Student',
        createdBy: mentorUserId,
      });

      await tx.insert(students).values({
        userId: cleanUserId,
        mentorId: mentorUserId,
        fullName: input.fullName,
        dateOfBirth: input.dateOfBirth,
        admissionYear,
        section: input.section,
      });
    });
  } catch (error) {
    const pgErr = error as { code?: string; detail?: string; constraint?: string };
    if (pgErr && pgErr.code === '23505') {
      const detail = pgErr.detail || '';
      if (detail.includes('user_id') || pgErr.constraint === 'users_pkey') {
        throw new AppError(400, 'USER_EXISTS', 'A student with this Register Number already exists.');
      }
      if (detail.includes('username') || pgErr.constraint === 'users_username_unique') {
        throw new AppError(400, 'USERNAME_TAKEN', 'A user with this username/Register Number already exists.');
      }
    }
    throw error;
  }

  return {
    userId: cleanUserId,
    username: cleanUserId,
    fullName: input.fullName,
    role: 'Student',
  };
};

export const getMenteesList = async (mentorUserId: string): Promise<Array<{
  userId: string;
  username: string;
  fullName: string;
  role: string;
  dateOfBirth: string;
  admissionYear: number;
  section: string;
  createdAt: Date;
}>> => {
  const list = await db
    .select({
      userId: users.userId,
      username: users.username,
      fullName: students.fullName,
      role: users.role,
      dateOfBirth: students.dateOfBirth,
      admissionYear: students.admissionYear,
      section: students.section,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(students, eq(users.userId, students.userId))
    .where(
      and(
        eq(students.mentorId, mentorUserId),
        isNull(users.deletedAt)
      )
    );

  return list;
};

export const updateStudent = async (
  studentId: string,
  input: { fullName?: string; dateOfBirth?: string; section?: string; password?: string },
  mentorUserId: string
): Promise<{ userId: string; fullName: string; section: string; dateOfBirth: string }> => {
  const cleanUserId = studentId.trim().toUpperCase();

  const [student] = await db
    .select({
      userId: students.userId,
      mentorId: students.mentorId,
      fullName: students.fullName,
      dateOfBirth: students.dateOfBirth,
      section: students.section,
    })
    .from(students)
    .innerJoin(users, eq(students.userId, users.userId))
    .where(
      and(
        eq(students.userId, cleanUserId),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (!student) {
    throw new AppError(404, 'NOT_FOUND', 'Student record not found.');
  }

  if (student.mentorId !== mentorUserId) {
    throw new AppError(403, 'FORBIDDEN', 'Access Denied: You are not the assigned mentor for this student.');
  }

  await db.transaction(async (tx) => {
    const studentUpdates: Partial<typeof students.$inferInsert> = {};
    if (input.fullName) studentUpdates.fullName = input.fullName;
    if (input.dateOfBirth) studentUpdates.dateOfBirth = input.dateOfBirth;
    if (input.section) studentUpdates.section = input.section;

    if (Object.keys(studentUpdates).length > 0) {
      await tx
        .update(students)
        .set(studentUpdates)
        .where(eq(students.userId, cleanUserId));
    }

    if (input.password) {
      const passwordHash = await hashPassword(input.password);
      await tx
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.userId, cleanUserId));
    }
  });

  return {
    userId: cleanUserId,
    fullName: input.fullName || student.fullName,
    dateOfBirth: input.dateOfBirth || student.dateOfBirth,
    section: input.section || student.section,
  };
};
