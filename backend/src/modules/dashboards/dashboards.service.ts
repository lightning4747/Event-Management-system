import { db } from '../../db';
import { odApplications, certificateRequirements, students } from '../../db/schema';
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

export interface MentorDashboardMetrics {
  totalMentees: number;
  pendingMenteeApprovals: number;
  pendingCertificateVerifications: number;
  menteesWithExpiredDeadlines: number;
}

export interface HODDashboardMetrics {
  totalApplications: number;
  approvedApplications: number;
  activeStudentsCount: number;
  pendingHODApprovals: number;
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

export const getMentorDashboardMetrics = async (mentorId: string): Promise<MentorDashboardMetrics> => {
  // 1. Total mentees
  const [menteesCount] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(students)
    .where(eq(students.mentorId, mentorId));

  // 2. Pending approvals for cohort mentees (status = 'In Progress: Mentor')
  const [pendingApprovals] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(odApplications)
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(
      and(
        eq(students.mentorId, mentorId),
        eq(odApplications.status, 'In Progress: Mentor')
      )
    );

  // 3. Mentees with pending certificate verifications
  const [pendingCerts] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(certificateRequirements)
    .innerJoin(odApplications, eq(certificateRequirements.applicationId, odApplications.applicationId))
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(
      and(
        eq(students.mentorId, mentorId),
        eq(certificateRequirements.status, 'Uploaded')
      )
    );

  // 4. Mentees with expired deadlines
  const [expiredCount] = await db
    .select({
      count: sql<number>`count(distinct ${students.userId})::int`,
    })
    .from(students)
    .innerJoin(odApplications, eq(students.userId, odApplications.studentId))
    .innerJoin(certificateRequirements, eq(odApplications.applicationId, certificateRequirements.applicationId))
    .where(
      and(
        eq(students.mentorId, mentorId),
        eq(certificateRequirements.status, 'Deadline Expired')
      )
    );

  return {
    totalMentees: menteesCount ? Number(menteesCount.count) : 0,
    pendingMenteeApprovals: pendingApprovals ? Number(pendingApprovals.count) : 0,
    pendingCertificateVerifications: pendingCerts ? Number(pendingCerts.count) : 0,
    menteesWithExpiredDeadlines: expiredCount ? Number(expiredCount.count) : 0,
  };
};

export const getHODDashboardMetrics = async (): Promise<HODDashboardMetrics> => {
  // 1. Total, Approved and HOD queue count
  const statusCounts = await db
    .select({
      status: odApplications.status,
      count: sql<number>`count(*)::int`,
    })
    .from(odApplications)
    .groupBy(odApplications.status);

  let totalApplications = 0;
  let approvedApplications = 0;
  let pendingHODApprovals = 0;

  for (const item of statusCounts) {
    const count = Number(item.count);
    totalApplications += count;

    if (item.status === 'Approved') {
      approvedApplications = count;
    } else if (item.status === 'In Progress: Head of Department') {
      pendingHODApprovals = count;
    }
  }

  // 2. Active students count (distinct studentId)
  const [activeCount] = await db
    .select({
      count: sql<number>`count(distinct ${odApplications.studentId})::int`,
    })
    .from(odApplications);

  return {
    totalApplications,
    approvedApplications,
    activeStudentsCount: activeCount ? Number(activeCount.count) : 0,
    pendingHODApprovals,
  };
};
