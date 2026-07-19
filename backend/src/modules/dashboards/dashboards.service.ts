import { db } from '../../db';
import { odApplications, certificateRequirements } from '../../db/schema';
import { eq, and, or, sql } from 'drizzle-orm';

export interface StudentDashboardMetrics {
  totalSubmitted: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  certificatesActionCount: number;
}

export const getStudentDashboardMetrics = async (studentId: string): Promise<StudentDashboardMetrics> => {
  // 1. Fetch application status counts
  const statusCounts = await db
    .select({
      status: odApplications.status,
      count: sql<number>`count(*)::int`,
    })
    .from(odApplications)
    .where(eq(odApplications.studentId, studentId))
    .groupBy(odApplications.status);

  let totalSubmitted = 0;
  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;

  for (const item of statusCounts) {
    const count = Number(item.count);
    totalSubmitted += count;

    if (item.status === 'Approved') {
      approvedCount += count;
    } else if (item.status === 'Rejected') {
      rejectedCount += count;
    } else if (item.status.startsWith('In Progress:')) {
      pendingCount += count;
    }
  }

  // 2. Fetch certificates requiring action (Pending Upload or Rejected)
  const [certsCount] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(certificateRequirements)
    .innerJoin(odApplications, eq(certificateRequirements.applicationId, odApplications.applicationId))
    .where(
      and(
        eq(odApplications.studentId, studentId),
        or(
          eq(certificateRequirements.status, 'Pending Upload'),
          eq(certificateRequirements.status, 'Rejected')
        )
      )
    );

  return {
    totalSubmitted,
    pendingCount,
    approvedCount,
    rejectedCount,
    certificatesActionCount: certsCount ? Number(certsCount.count) : 0,
  };
};
