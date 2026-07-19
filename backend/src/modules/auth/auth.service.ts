import { db } from '../../db';
import { users } from '../../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { comparePassword } from '../../utils/crypto';
import { signToken } from '../../utils/jwt';
import { AppError } from '../../lib/errors';
import { LoginInput } from './auth.types';

export const loginUser = async (input: LoginInput): Promise<{ token: string; role: string; userId: string }> => {
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.username, input.username),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'The username or password provided is incorrect.');
  }

  const isPasswordValid = await comparePassword(input.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'The username or password provided is incorrect.');
  }

  const token = signToken({
    userId: user.userId,
    role: user.role,
  });

  return {
    token,
    role: user.role,
    userId: user.userId,
  };
};
