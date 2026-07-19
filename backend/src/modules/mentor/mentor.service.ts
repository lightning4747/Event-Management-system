import { db } from '../../db';
import { users, students } from '../../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { hashPassword } from '../../utils/crypto';
import { AppError } from '../../lib/errors';
import { CreateStudentInput } from './mentor.types';

export const createStudent = async (
  input: CreateStudentInput,
  mentorUserId: string
): Promise<{ userId: string; username: string; fullName: string; role: string }> => {
  // Check if userId or username already exists
  const [existingUserById] = await db
    .select()
    .from(users)
    .where(eq(users.userId, input.userId))
    .limit(1);

  if (existingUserById) {
    throw new AppError(400, 'USER_EXISTS', 'A student with this Register Number already exists.');
  }

  const [existingUserByName] = await db
    .select()
    .from(users)
    .where(eq(users.username, input.username))
    .limit(1);

  if (existingUserByName) {
    throw new AppError(400, 'USERNAME_TAKEN', 'This username is already taken.');
  }

  const dobParts = input.dateOfBirth.split('-');
  const dobPassword = `${dobParts[2]}${dobParts[1]}${dobParts[0]}`;
  const passwordHash = await hashPassword(dobPassword);

  try {
    // Run in a database transaction to ensure atomicity
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        userId: input.userId,
        username: input.username,
        passwordHash,
        role: 'Student',
        createdBy: mentorUserId,
      });

      await tx.insert(students).values({
        userId: input.userId,
        mentorId: mentorUserId,
        fullName: input.fullName,
        dateOfBirth: input.dateOfBirth,
        admissionYear: input.admissionYear,
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
        throw new AppError(400, 'USERNAME_TAKEN', 'This username is already taken.');
      }
    }
    throw error;
  }

  return {
    userId: input.userId,
    username: input.username,
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
