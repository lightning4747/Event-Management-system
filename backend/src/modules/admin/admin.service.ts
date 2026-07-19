import { db } from '../../db';
import { users, faculty } from '../../db/schema';
import { eq, isNull } from 'drizzle-orm';
import { hashPassword } from '../../utils/crypto';
import { AppError } from '../../lib/errors';
import { CreateFacultyInput } from './admin.types';

export const createFaculty = async (
  input: CreateFacultyInput,
  adminUserId: string
): Promise<{ userId: string; username: string; fullName: string; role: string }> => {
  // Check if userId or username already exists
  const [existingUserById] = await db
    .select()
    .from(users)
    .where(eq(users.userId, input.userId))
    .limit(1);

  if (existingUserById) {
    throw new AppError(400, 'USER_EXISTS', 'A user with this Register/Faculty ID already exists.');
  }

  const [existingUserByName] = await db
    .select()
    .from(users)
    .where(eq(users.username, input.username))
    .limit(1);

  if (existingUserByName) {
    throw new AppError(400, 'USERNAME_TAKEN', 'This username is already taken.');
  }

  const passwordHash = await hashPassword(input.password);

  // Run in a database transaction to ensure atomicity
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      userId: input.userId,
      username: input.username,
      passwordHash,
      role: input.role,
      createdBy: adminUserId,
    });

    await tx.insert(faculty).values({
      userId: input.userId,
      fullName: input.fullName,
      designation: input.designation,
    });
  });

  return {
    userId: input.userId,
    username: input.username,
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
    .where(isNull(users.deletedAt));

  return list;
};
