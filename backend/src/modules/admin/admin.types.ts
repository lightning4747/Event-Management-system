import { z } from 'zod';

export const createFacultySchema = z.object({
  userId: z.string().min(1, 'User ID (Register/Faculty ID) is required.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  role: z.enum(['Mentor', 'Event Coordinator', 'Administrator']),
  fullName: z.string().min(1, 'Full name is required.'),
  designation: z.string().min(1, 'Designation is required.'),
});

export type CreateFacultyInput = z.infer<typeof createFacultySchema>;

export const assignRoleSchema = z.object({
  userId: z.string().min(1, 'User ID is required.'),
  role: z.enum(['Head of Department', 'Program Coordinator']),
});

export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
