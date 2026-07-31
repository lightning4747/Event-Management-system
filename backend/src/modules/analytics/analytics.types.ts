import { z } from 'zod';

export const analyticsFilterSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  admissionYear: z.string().transform((v) => (v ? Number(v) : undefined)).optional(),
  section: z.string().optional(),
  activityCategory: z.enum(['Co-curricular', 'Extracurricular', 'Others']).optional(),
  activityType: z.string().optional(),
});

export type AnalyticsFilterInput = z.infer<typeof analyticsFilterSchema>;
