import { z } from 'zod';

export const createStudentSchema = z.object({
  userId: z.string().min(1, 'Student Register Number is required.'),
  fullName: z.string().min(1, 'Full name is required.'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of Birth must be in YYYY-MM-DD format.'),
  section: z.string().min(1, 'Section is required.'),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
