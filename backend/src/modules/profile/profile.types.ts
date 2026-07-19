import { z } from 'zod';

export const updateProfileSchema = z.object({
  username: z.string().min(1, 'Username cannot be empty.').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters.').optional(),
  currentPassword: z.string().min(1, 'Current password cannot be empty.').optional(),
}).refine((data) => {
  if ((data.username !== undefined || data.password !== undefined) && !data.currentPassword) {
    return false;
  }
  return true;
}, {
  message: 'Current password is required to change username or password.',
  path: ['currentPassword'],
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
