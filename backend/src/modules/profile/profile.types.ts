import { z } from 'zod';

export const updateProfileSchema = z.object({
  username: z.string().min(1, 'Username cannot be empty.').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters.').optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
