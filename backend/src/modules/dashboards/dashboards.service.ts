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

export interface ECDashboardMetrics {
  totalApplications: number;
  pendingECApprovals: number;
  pendingCertificateVerifications: number;
}

export const getStudentDashboardMetrics = async (studentId: string): Promise<StudentDashboardMetrics> => {
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

export const getECDashboardMetrics = async (): Promise<ECDashboardMetrics> => {
  const statusCounts = await db
    .select({
      status: odApplications.status,
      count: sql<number>`count(*)::int`,
    })
    .from(odApplications)
    .groupBy(odApplications.status);

  let totalApplications = 0;
  let pendingECApprovals = 0;

  for (const item of statusCounts) {
    const count = Number(item.count);
    totalApplications += count;

    if (item.status === 'In Progress: Event Coordinator') {
      pendingECApprovals = count;
    }
  }

  const [certsCount] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(certificateRequirements)
    .where(eq(certificateRequirements.status, 'Uploaded'));

  return {
    totalApplications,
    pendingECApprovals,
    pendingCertificateVerifications: certsCount ? Number(certsCount.count) : 0,
  };
};
