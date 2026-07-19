import { db } from '../../db';
import { odApplications, students, applicationApprovalHistory } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '../../lib/errors';
import { MakeDecisionInput } from './decisions.types';

export const makeApprovalDecision = async (
  applicationId: bigint,
  userId: string,
  role: 'Student' | 'Event Coordinator' | 'Mentor' | 'Program Coordinator' | 'Head of Department' | 'Administrator',
  input: MakeDecisionInput
): Promise<{ newStatus: string }> => {
  // 1. Fetch application details and cohort mentor configuration
  const [app] = await db
    .select({
      applicationId: odApplications.applicationId,
      status: odApplications.status,
      mentorId: students.mentorId,
    })
    .from(odApplications)
    .innerJoin(students, eq(odApplications.studentId, students.userId))
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

  // Validate Event Coordinator and Mentor stages
  if (currentStatus === 'In Progress: Event Coordinator') {
    if (role !== 'Event Coordinator') {
      throw new AppError(403, 'FORBIDDEN', 'Only Event Coordinators can review applications at this stage.');
    }
  } else if (currentStatus === 'In Progress: Mentor') {
    if (role !== 'Mentor') {
      throw new AppError(403, 'FORBIDDEN', 'Only Mentors can review applications at this stage.');
    }
    // Cohort Guard check
    if (app.mentorId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Access Denied: You are not the assigned mentor for this student.');
    }
  } else {
    // Other stages placeholder
    if (role !== 'Event Coordinator' && role !== 'Mentor') {
      throw new AppError(403, 'FORBIDDEN', 'Only authorized faculty members can review applications.');
    }
  }

  let newStatus: 'In Progress: Event Coordinator' | 'In Progress: Mentor' | 'In Progress: Program Coordinator' | 'In Progress: Head of Department' | 'Approved' | 'Rejected' | 'Withdrawn';

  if (input.decision === 'Reject') {
    newStatus = 'Rejected';
  } else {
    if (currentStatus === 'In Progress: Event Coordinator') {
      newStatus = 'In Progress: Mentor';
    } else if (currentStatus === 'In Progress: Mentor') {
      newStatus = 'In Progress: Program Coordinator';
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
