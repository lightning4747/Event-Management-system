import { z } from 'zod';

export const requestExtensionSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required.'),
  requestedDays: z.number().int().min(1, 'Requested extension days must be at least 1.').max(14, 'Requested extension days cannot exceed 14.').default(7),
  reason: z.string().min(10, 'Reason must be at least 10 characters long.').max(1000, 'Reason must not exceed 1000 characters.'),
});

export type RequestExtensionInput = z.infer<typeof requestExtensionSchema>;

export const decideExtensionSchema = z.object({
  decision: z.enum(['Approve', 'Reject']),
  comments: z.string().optional(),
}).refine(data => {
  if (data.decision === 'Reject') {
    return data.comments !== undefined && data.comments.trim().length > 0;
  }
  return true;
}, {
  message: 'Rejection reason is mandatory when rejecting an extension request.',
  path: ['comments'],
});

export type DecideExtensionInput = z.infer<typeof decideExtensionSchema>;
