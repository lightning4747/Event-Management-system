import { z } from 'zod';

export const createExtensionSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required.'),
  newDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'New Deadline must be in YYYY-MM-DD format.'),
  reason: z.string().min(10, 'Reason must be at least 10 characters long.').max(1000, 'Reason must not exceed 1000 characters.'),
});

export type CreateExtensionInput = z.infer<typeof createExtensionSchema>;
