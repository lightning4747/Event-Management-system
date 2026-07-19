import { z } from 'zod';

export const createFacultySchema = z.object({
  userId: z.string().min(1, 'User ID (Register/Faculty ID) is required.'),
  username: z.string().min(1, 'Username is required.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  role: z.enum(['Mentor', 'Event Coordinator', 'Program Coordinator', 'Head of Department', 'Administrator']),
  fullName: z.string().min(1, 'Full name is required.'),
  designation: z.string().min(1, 'Designation is required.'),
});

export type CreateFacultyInput = z.infer<typeof createFacultySchema>;
