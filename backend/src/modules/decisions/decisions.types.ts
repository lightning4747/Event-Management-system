import { z } from 'zod';

export const makeDecisionSchema = z.object({
  decision: z.enum(['Approve', 'Reject']),
  comments: z.string().optional(),
}).refine(data => {
  if (data.decision === 'Reject') {
    return data.comments !== undefined && data.comments.trim().length > 0;
  }
  return true;
}, {
  message: 'Comments are mandatory when rejecting an application.',
  path: ['comments'],
});

export type MakeDecisionInput = z.infer<typeof makeDecisionSchema>;

export const WORKFLOW_STAGES = [
  'Event Coordinator',
  'Mentor',
  'Program Coordinator',
  'Head of Department'
] as const;

export type WorkflowStage = typeof WORKFLOW_STAGES[number];
