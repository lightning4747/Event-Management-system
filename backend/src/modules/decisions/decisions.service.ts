import { db } from '../../db';
import { odApplications, students, users, applicationApprovalHistory, certificateRequirements } from '../../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { AppError } from '../../lib/errors';
import { MakeDecisionInput } from './decisions.types';
import { storageService } from '../../services/storage/storage.service';
import { logger } from '../../utils/logger';

const addDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

export const makeApprovalDecision = async (
  applicationId: bigint,
  userId: string,
  role: 'Student' | 'Event Coordinator' | 'Mentor' | 'Program Coordinator' | 'Head of Department' | 'Administrator',
  input: MakeDecisionInput
): Promise<{ newStatus: string }> => {
  const result = await db.transaction(async (tx) => {
    // 1. Fetch application details and cohort mentor configuration with row lock
    const [app] = await tx
      .select({
        applicationId: odApplications.applicationId,
        status: odApplications.status,
        mentorId: students.mentorId,
        numberOfEvents: odApplications.numberOfEvents,
        toDate: odApplications.toDate,
        activityCategory: odApplications.activityCategory,
        activityType: odApplications.activityType,
        events: odApplications.events,
        proofFileUrl: odApplications.proofFileUrl,
      })
      .from(odApplications)
      .innerJoin(students, eq(odApplications.studentId, students.userId))
      .innerJoin(users, eq(odApplications.studentId, users.userId))
      .where(
        and(
          eq(odApplications.applicationId, applicationId),
          isNull(users.deletedAt)
        )
      )
      .for('update', { of: odApplications })
      .limit(1);

    if (!app) {
      throw new AppError(404, 'NOT_FOUND', 'On-Duty application not found.');
    }

    const currentStatus = app.status;

    // Validate application immutability
    if (currentStatus === 'Approved' || currentStatus === 'Rejected' || currentStatus === 'Withdrawn') {
      throw new AppError(400, 'APPLICATION_IMMUTABLE', 'This On-Duty application has already been decided or withdrawn.');
    }

    // Validate stages
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
    } else if (currentStatus === 'In Progress: Program Coordinator') {
      if (role !== 'Program Coordinator') {
        throw new AppError(403, 'FORBIDDEN', 'Only Program Coordinators can review applications at this stage.');
      }
    } else if (currentStatus === 'In Progress: Head of Department') {
      if (role !== 'Head of Department') {
        throw new AppError(403, 'FORBIDDEN', 'Only the Head of Department can review applications at this stage.');
      }
    } else {
      throw new AppError(400, 'INVALID_STAGE', 'The application is in an invalid review stage.');
    }

    let newStatus: 'In Progress: Event Coordinator' | 'In Progress: Mentor' | 'In Progress: Program Coordinator' | 'In Progress: Head of Department' | 'Approved' | 'Rejected' | 'Withdrawn';

    if (input.decision === 'Reject') {
      newStatus = 'Rejected';
    } else {
      if (currentStatus === 'In Progress: Event Coordinator') {
        newStatus = 'In Progress: Mentor';
      } else if (currentStatus === 'In Progress: Mentor') {
        newStatus = 'In Progress: Program Coordinator';
      } else if (currentStatus === 'In Progress: Program Coordinator') {
        newStatus = 'In Progress: Head of Department';
      } else {
        newStatus = 'Approved';
      }
    }

    // A. Update application status
    const updateData: Partial<typeof odApplications.$inferInsert> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    if (newStatus === 'Approved') {
      updateData.finalApprovedAt = new Date();
    }

    await tx
      .update(odApplications)
      .set(updateData)
      .where(eq(odApplications.applicationId, applicationId));

    // B. Insert log record
    await tx.insert(applicationApprovalHistory).values({
      applicationId,
      approverId: userId,
      approverRole: role,
      decision: input.decision,
      comments: input.comments || null,
    });

    // C. Trigger certificate requirement generation
    if (newStatus === 'Approved') {
      const deadline = addDays(app.toDate, 7);
      const requirementsToInsert = Array.from({ length: app.numberOfEvents }).map((_, index) => {
        const eventData = app.events?.[index];
        return {
          applicationId,
          sequenceNumber: index + 1,
          activityCategory: eventData?.activityCategory || app.activityCategory || 'Co-curricular',
          activityType: eventData?.activityType || app.activityType || 'General',
          status: 'Pending Upload' as const,
          submissionDeadline: deadline,
        };
      });

      await tx.insert(certificateRequirements).values(requirementsToInsert);
    }

    // D. Delete proof from storage if the application was rejected — best-effort
    if (newStatus === 'Rejected' && app.proofFileUrl) {
      const proofKey = decodeURIComponent(app.proofFileUrl.replace('/api/files/', ''));
      await storageService.deleteFile(proofKey).catch((e: unknown) =>
        logger.warn({ proofKey, err: (e as Error)?.message }, 'Failed to delete proof on rejection')
      );
    }

    return { newStatus };
  });

  return result;
};
