import { z } from 'zod';

export const exportFilterSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'From date must be YYYY-MM-DD format.').optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'To date must be YYYY-MM-DD format.').optional(),
  section: z.string().optional(),
  admissionYear: z.string().regex(/^\d{4}$/).transform(val => parseInt(val, 10)).optional(),
});

export type ExportFilterInput = z.infer<typeof exportFilterSchema>;
