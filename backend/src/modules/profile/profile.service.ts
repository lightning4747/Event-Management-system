import { db } from '../../db';
import { users, students, faculty } from '../../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { hashPassword, comparePassword } from '../../utils/crypto';
import { AppError } from '../../lib/errors';
import { UpdateProfileInput } from './profile.types';

export interface UserProfileResponse {
  userId: string;
  username: string;
  role: string;
  fullName?: string;
  dateOfBirth?: string;
  admissionYear?: number;
  section?: string;
  designation?: string;
  createdAt: Date;
}

export const getProfile = async (
  userId: string,
  role: string
): Promise<UserProfileResponse> => {
  if (role === 'Student') {
    const [studentProfile] = await db
      .select({
        userId: users.userId,
        username: users.username,
        role: users.role,
        fullName: students.fullName,
        dateOfBirth: students.dateOfBirth,
        admissionYear: students.admissionYear,
        section: students.section,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(students, eq(users.userId, students.userId))
      .where(
        and(
          eq(users.userId, userId),
          isNull(users.deletedAt)
        )
      )
      .limit(1);

    if (!studentProfile) {
      throw new AppError(404, 'NOT_FOUND', 'Student profile details not found.');
    }
    return studentProfile;
  }

  // Otherwise check if faculty
  const [facultyProfile] = await db
    .select({
      userId: users.userId,
      username: users.username,
      role: users.role,
      fullName: faculty.fullName,
      designation: faculty.designation,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(faculty, eq(users.userId, faculty.userId))
    .where(
      and(
        eq(users.userId, userId),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (facultyProfile) {
    return facultyProfile;
  }

  // General user profile fallback (e.g. administrator who is not in faculty table)
  const [userProfile] = await db
    .select({
      userId: users.userId,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        eq(users.userId, userId),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (!userProfile) {
    throw new AppError(404, 'NOT_FOUND', 'User profile not found.');
  }

  return userProfile;
};

export const updateProfile = async (
  userId: string,
  input: UpdateProfileInput
): Promise<{ userId: string; username: string }> => {
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.userId, userId),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User account not found.');
  }

  // Verify current password if trying to update username or password
  if (input.username || input.password) {
    if (user.role === 'Student' && input.password) {
      throw new AppError(400, 'PASSWORD_CHANGE_BLOCKED', 'Students are not allowed to change their passwords.');
    }

    if (!input.currentPassword) {
      throw new AppError(400, 'BAD_REQUEST', 'Current password is required to change username or password.');
    }
    const isPasswordValid = await comparePassword(input.currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError(400, 'INVALID_CREDENTIALS', 'Invalid current password.');
    }
  }

  const updateData: Partial<typeof users.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.username) {
    // Verify username is not taken by another user
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, input.username))
      .limit(1);

    if (existingUser && existingUser.userId !== userId) {
      throw new AppError(400, 'USERNAME_TAKEN', 'This username is already taken.');
    }
    updateData.username = input.username;
  }

  if (input.password) {
    updateData.passwordHash = await hashPassword(input.password);
  }

  try {
    await db
      .update(users)
      .set(updateData)
      .where(eq(users.userId, userId));
  } catch (error) {
    const pgErr = error as { code?: string; detail?: string; constraint?: string };
    if (pgErr && pgErr.code === '23505') {
      throw new AppError(400, 'USERNAME_TAKEN', 'This username is already taken.');
    }
    throw error;
  }

  return {
    userId,
    username: input.username || user.username,
  };
};
