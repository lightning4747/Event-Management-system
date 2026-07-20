import { db } from '../../db';
import { users, faculty } from '../../db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { hashPassword } from '../../utils/crypto';
import { AppError } from '../../lib/errors';
import { CreateFacultyInput } from './admin.types';

export const createFaculty = async (
  input: CreateFacultyInput,
  adminUserId: string
): Promise<{ userId: string; username: string; fullName: string; role: string }> => {
  const cleanUserId = input.userId.trim().toUpperCase();

  // Check if userId already exists
  const [existingUserById] = await db
    .select()
    .from(users)
    .where(eq(users.userId, cleanUserId))
    .limit(1);

  if (existingUserById) {
    throw new AppError(400, 'USER_EXISTS', 'A user with this Register/Faculty ID already exists.');
  }

  const passwordHash = await hashPassword(input.password);

  try {
    // Run in a database transaction to ensure atomicity
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        userId: cleanUserId,
        username: cleanUserId, // Set username to cleanUserId to eliminate separate concept
        passwordHash,
        role: input.role,
        createdBy: adminUserId,
      });

      await tx.insert(faculty).values({
        userId: cleanUserId,
        fullName: input.fullName,
        designation: input.designation,
      });
    });
  } catch (error) {
    const pgErr = error as { code?: string; detail?: string; constraint?: string };
    if (pgErr && pgErr.code === '23505') {
      const detail = pgErr.detail || '';
      if (detail.includes('user_id') || pgErr.constraint === 'users_pkey') {
        throw new AppError(400, 'USER_EXISTS', 'A user with this Register/Faculty ID already exists.');
      }
      if (detail.includes('username') || pgErr.constraint === 'users_username_unique') {
        throw new AppError(400, 'USERNAME_TAKEN', 'A user with this Register/Faculty ID already exists.');
      }
    }
    throw error;
  }

  return {
    userId: cleanUserId,
    username: cleanUserId,
    fullName: input.fullName,
    role: input.role,
  };
};

export const getFacultyList = async (): Promise<Array<{
  userId: string;
  username: string;
  fullName: string;
  role: string;
  designation: string;
  createdAt: Date;
}>> => {
  const list = await db
    .select({
      userId: users.userId,
      username: users.username,
      fullName: faculty.fullName,
      role: users.role,
      designation: faculty.designation,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(faculty, eq(users.userId, faculty.userId))
    .where(isNull(users.deletedAt))
    .orderBy(faculty.fullName);

  return list;
};

export const assignSpecialRole = async (
  input: { userId: string; role: 'Head of Department' | 'Program Coordinator' | 'Event Coordinator' | 'Mentor' }
): Promise<{ userId: string; role: string; designation: string }> => {
  const [targetUser] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.userId, input.userId),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (!targetUser) {
    throw new AppError(404, 'NOT_FOUND', 'Faculty user not found.');
  }

  if (targetUser.role === 'Student' || targetUser.role === 'Administrator') {
    throw new AppError(400, 'INVALID_ROLE_ASSIGNMENT', 'Can only assign faculty roles to faculty members.');
  }

  return db.transaction(async (tx) => {
    // If assigning a unique special role (HOD, PC, EC), demote the previous holder to Mentor
    if (input.role !== 'Mentor') {
      const [prevHolder] = await tx
        .select()
        .from(users)
        .where(
          and(
            eq(users.role, input.role),
            isNull(users.deletedAt)
          )
        )
        .limit(1);

      if (prevHolder && prevHolder.userId !== input.userId) {
        await tx
          .update(users)
          .set({ role: 'Mentor', updatedAt: new Date() })
          .where(eq(users.userId, prevHolder.userId));

        await tx
          .update(faculty)
          .set({ designation: 'Assistant Professor' })
          .where(eq(faculty.userId, prevHolder.userId));
      }
    }

    // Determine the designation
    let designation = 'Assistant Professor';
    if (input.role === 'Head of Department') {
      designation = 'Head of Department - AI&DS';
    } else if (input.role === 'Program Coordinator') {
      designation = 'Program Coordinator - AI&DS';
    } else if (input.role === 'Event Coordinator') {
      designation = 'Event Coordinator - AI&DS';
    }

    // Assign the new role and designation
    await tx
      .update(users)
      .set({ role: input.role, updatedAt: new Date() })
      .where(eq(users.userId, input.userId));

    await tx
      .update(faculty)
      .set({ designation })
      .where(eq(faculty.userId, input.userId));

    return {
      userId: input.userId,
      role: input.role,
      designation,
    };
  });
};
