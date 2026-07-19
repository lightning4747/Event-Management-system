import { db } from '../../db';
import { odApplications, applicationApprovalHistory } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '../../lib/errors';
import { MakeDecisionInput } from './decisions.types';

export const makeApprovalDecision = async (
  applicationId: bigint,
  userId: string,
  role: 'Student' | 'Event Coordinator' | 'Mentor' | 'Program Coordinator' | 'Head of Department' | 'Administrator',
  input: MakeDecisionInput
): Promise<{ newStatus: string }> => {
  const [app] = await db
    .select()
    .from(odApplications)
    .where(eq(odApplications.applicationId, applicationId))
    .limit(1);

  if (!app) {
    throw new AppError(404, 'NOT_FOUND', 'On-Duty application not found.');
  }

  // Base state routing logic for Task 6.2 transaction check
  const nextStatus = input.decision === 'Reject' ? 'Rejected' : 'Approved';

  await db.transaction(async (tx) => {
    await tx
      .update(odApplications)
      .set({
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(odApplications.applicationId, applicationId));

    await tx.insert(applicationApprovalHistory).values({
      applicationId,
      approverId: userId,
      approverRole: role,
      decision: input.decision,
      comments: input.comments || null,
    });
  });

  return { newStatus: nextStatus };
};
