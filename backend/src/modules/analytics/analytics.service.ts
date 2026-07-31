import { db } from '../../db';
import { odApplications, students, certificateRequirements } from '../../db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { AnalyticsFilterInput } from './analytics.types';

export interface AnalyticsResponse {
  summary: {
    totalApplications: number;
    approved: number;
    pending: number;
    rejected: number;
    certificatesUploaded: number;
    certificatesVerified: number;
  };
  monthlyTrend: Array<{
    month: string;
    totalCount: number;
    approvedCount: number;
  }>;
  byStudentYear: Array<{
    yearLabel: string;
    admissionYear: number;
    count: number;
  }>;
  bySectionGrouped: Array<{
    yearLabel: string;
    admissionYear: number;
    sections: Array<{ section: string; count: number }>;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  categoryDistribution: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  activityTypeDistribution: Array<{
    activityType: string;
    count: number;
  }>;
  certificateStatusDistribution: Array<{
    status: string;
    count: number;
  }>;
}

export const getAnalyticsData = async (filters: AnalyticsFilterInput): Promise<AnalyticsResponse> => {
  const conditions = [];

  if (filters.fromDate) {
    conditions.push(gte(odApplications.fromDate, filters.fromDate));
  }
  if (filters.toDate) {
    conditions.push(lte(odApplications.toDate, filters.toDate));
  }
  if (filters.activityCategory) {
    conditions.push(eq(odApplications.activityCategory, filters.activityCategory));
  }
  if (filters.activityType) {
    conditions.push(eq(odApplications.activityType, filters.activityType));
  }
  if (filters.admissionYear) {
    conditions.push(eq(students.admissionYear, filters.admissionYear));
  }
  if (filters.section) {
    conditions.push(eq(students.section, filters.section));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 1. Summary Card Aggregations
  const [summaryRow] = await db
    .select({
      totalApplications: sql<number>`count(distinct ${odApplications.applicationId})::int`,
      approved: sql<number>`count(distinct case when ${odApplications.status} = 'Approved' then ${odApplications.applicationId} end)::int`,
      pending: sql<number>`count(distinct case when ${odApplications.status}::text like 'In Progress%' then ${odApplications.applicationId} end)::int`,
      rejected: sql<number>`count(distinct case when ${odApplications.status} = 'Rejected' then ${odApplications.applicationId} end)::int`,
    })
    .from(odApplications)
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(whereClause);

  // Certificate Summary
  const [certSummaryRow] = await db
    .select({
      certificatesUploaded: sql<number>`count(distinct case when ${certificateRequirements.status} in ('Uploaded', 'Verified') then ${certificateRequirements.requirementId} end)::int`,
      certificatesVerified: sql<number>`count(distinct case when ${certificateRequirements.status} = 'Verified' then ${certificateRequirements.requirementId} end)::int`,
    })
    .from(certificateRequirements)
    .innerJoin(odApplications, eq(certificateRequirements.applicationId, odApplications.applicationId))
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(whereClause);

  const totalApps = summaryRow?.totalApplications || 0;

  // 2. Monthly Applications Trend (Last 6 Months)
  const monthlyTrendRows = await db
    .select({
      month: sql<string>`to_char(${odApplications.createdAt}, 'Mon YYYY')`,
      sortKey: sql<string>`to_char(${odApplications.createdAt}, 'YYYY-MM')`,
      totalCount: sql<number>`count(${odApplications.applicationId})::int`,
      approvedCount: sql<number>`count(case when ${odApplications.status} = 'Approved' then 1 end)::int`,
    })
    .from(odApplications)
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(whereClause)
    .groupBy(sql`to_char(${odApplications.createdAt}, 'Mon YYYY')`, sql`to_char(${odApplications.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${odApplications.createdAt}, 'YYYY-MM')`);

  const currentYear = new Date().getFullYear();

  // Helper function to map admission year to label
  const getYearLabel = (admissionYear: number) => {
    const diff = currentYear - admissionYear;
    if (diff === 1) return '2nd Year';
    if (diff === 2) return '3rd Year';
    if (diff === 3) return '4th Year';
    if (diff === 0) return '1st Year';
    return `${admissionYear} Batch`;
  };

  // 3. Applications by Student Year
  const byYearRows = await db
    .select({
      admissionYear: students.admissionYear,
      count: sql<number>`count(${odApplications.applicationId})::int`,
    })
    .from(odApplications)
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(whereClause)
    .groupBy(students.admissionYear)
    .orderBy(students.admissionYear);

  const byStudentYear = byYearRows.map((r) => ({
    yearLabel: getYearLabel(r.admissionYear),
    admissionYear: r.admissionYear,
    count: r.count,
  }));

  // 4. Applications by Section Grouped under Year
  const bySectionRows = await db
    .select({
      admissionYear: students.admissionYear,
      section: students.section,
      count: sql<number>`count(${odApplications.applicationId})::int`,
    })
    .from(odApplications)
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(whereClause)
    .groupBy(students.admissionYear, students.section)
    .orderBy(students.admissionYear, students.section);

  const groupedYearMap = new Map<number, Array<{ section: string; count: number }>>();
  bySectionRows.forEach((row) => {
    const list = groupedYearMap.get(row.admissionYear) || [];
    list.push({ section: row.section, count: row.count });
    groupedYearMap.set(row.admissionYear, list);
  });

  const bySectionGrouped = Array.from(groupedYearMap.entries()).map(([admYear, sections]) => ({
    yearLabel: getYearLabel(admYear),
    admissionYear: admYear,
    sections,
  }));

  // 5. Application Status Distribution
  const statusRows = await db
    .select({
      rawStatus: odApplications.status,
      count: sql<number>`count(${odApplications.applicationId})::int`,
    })
    .from(odApplications)
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(whereClause)
    .groupBy(odApplications.status);

  // Group pending statuses together
  let approvedCount = 0;
  let rejectedCount = 0;
  let pendingCount = 0;
  let withdrawnCount = 0;

  statusRows.forEach((r) => {
    if (r.rawStatus === 'Approved') approvedCount += r.count;
    else if (r.rawStatus === 'Rejected') rejectedCount += r.count;
    else if (r.rawStatus === 'Withdrawn') withdrawnCount += r.count;
    else pendingCount += r.count;
  });

  const statusDistribution = [
    { status: 'Approved', count: approvedCount, percentage: totalApps ? Math.round((approvedCount / totalApps) * 100) : 0 },
    { status: 'Rejected', count: rejectedCount, percentage: totalApps ? Math.round((rejectedCount / totalApps) * 100) : 0 },
    { status: 'Pending', count: pendingCount, percentage: totalApps ? Math.round((pendingCount / totalApps) * 100) : 0 },
    { status: 'Withdrawn', count: withdrawnCount, percentage: totalApps ? Math.round((withdrawnCount / totalApps) * 100) : 0 },
  ];

  // 6. Activity Category Distribution
  const categoryRows = await db
    .select({
      category: odApplications.activityCategory,
      count: sql<number>`count(${odApplications.applicationId})::int`,
    })
    .from(odApplications)
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(whereClause)
    .groupBy(odApplications.activityCategory);

  const categoryDistribution = categoryRows.map((r) => ({
    category: r.category,
    count: r.count,
    percentage: totalApps ? Math.round((r.count / totalApps) * 100) : 0,
  }));

  // 7. Activity Type Distribution
  const activityTypeRows = await db
    .select({
      activityType: odApplications.activityType,
      count: sql<number>`count(${odApplications.applicationId})::int`,
    })
    .from(odApplications)
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(whereClause)
    .groupBy(odApplications.activityType)
    .orderBy(sql`count(${odApplications.applicationId}) desc`);

  // 8. Certificate Status Distribution
  const certStatusRows = await db
    .select({
      status: certificateRequirements.status,
      count: sql<number>`count(${certificateRequirements.requirementId})::int`,
    })
    .from(certificateRequirements)
    .innerJoin(odApplications, eq(certificateRequirements.applicationId, odApplications.applicationId))
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(whereClause)
    .groupBy(certificateRequirements.status);

  return {
    summary: {
      totalApplications: summaryRow?.totalApplications || 0,
      approved: summaryRow?.approved || 0,
      pending: summaryRow?.pending || 0,
      rejected: summaryRow?.rejected || 0,
      certificatesUploaded: certSummaryRow?.certificatesUploaded || 0,
      certificatesVerified: certSummaryRow?.certificatesVerified || 0,
    },
    monthlyTrend: monthlyTrendRows.map((r) => ({
      month: r.month,
      totalCount: r.totalCount,
      approvedCount: r.approvedCount,
    })),
    byStudentYear,
    bySectionGrouped,
    statusDistribution,
    categoryDistribution,
    activityTypeDistribution: activityTypeRows,
    certificateStatusDistribution: certStatusRows,
  };
};
