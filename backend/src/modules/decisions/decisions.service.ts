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
  // 1. Fetch application details
  const [app] = await db
    .select({
      applicationId: odApplications.applicationId,
      status: odApplications.status,
    })
    .from(odApplications)
    .where(eq(odApplications.applicationId, applicationId))
    .limit(1);

  if (!app) {
    throw new AppError(404, 'NOT_FOUND', 'On-Duty application not found.');
  }

  const currentStatus = app.status;

  // Validate application immutability
  if (currentStatus === 'Approved' || currentStatus === 'Rejected' || currentStatus === 'Withdrawn') {
    throw new AppError(400, 'APPLICATION_IMMUTABLE', 'This On-Duty application has already been decided or withdrawn.');
  }

  // Validate Event Coordinator stage
  if (currentStatus === 'In Progress: Event Coordinator') {
    if (role !== 'Event Coordinator') {
      throw new AppError(403, 'FORBIDDEN', 'Only Event Coordinators can review applications at this stage.');
    }
  } else {
    // Other stages placeholder
    if (role !== 'Event Coordinator') {
      throw new AppError(403, 'FORBIDDEN', 'Only authorized faculty members can review applications.');
    }
  }

  let newStatus: 'In Progress: Event Coordinator' | 'In Progress: Mentor' | 'In Progress: Program Coordinator' | 'In Progress: Head of Department' | 'Approved' | 'Rejected' | 'Withdrawn';

  if (input.decision === 'Reject') {
    newStatus = 'Rejected';
  } else {
    if (currentStatus === 'In Progress: Event Coordinator') {
      newStatus = 'In Progress: Mentor';
    } else {
      newStatus = 'Approved'; // Placeholder fallback
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(odApplications)
      .set({
        status: newStatus,
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

  return { newStatus };
};
