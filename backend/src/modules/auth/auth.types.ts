import { z } from 'zod';

export const loginSchema = z.object({
  userId: z.string().min(1, 'Register Number or Faculty ID is required.'),
  password: z.string().min(1, 'Password is required.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
