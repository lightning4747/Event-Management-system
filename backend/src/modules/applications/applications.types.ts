import { z } from 'zod';

export const createApplicationSchema = z.object({
  title: z.string().min(1, 'Title is required.').max(255, 'Title must not exceed 255 characters.'),
  location: z.string().min(1, 'Location is required.').max(255, 'Location must not exceed 255 characters.'),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'From Date must be in YYYY-MM-DD format.'),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'To Date must be in YYYY-MM-DD format.'),
  numberOfEvents: z.number().int().positive('Number of events must be greater than 0.'),
}).refine(data => data.fromDate <= data.toDate, {
  message: 'From Date must be less than or equal to To Date.',
  path: ['fromDate'],
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
