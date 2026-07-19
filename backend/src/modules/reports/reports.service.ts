import { db } from '../../db';
import { odApplications, students } from '../../db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { convertToCSV } from '../../utils/csv';
import { ExportFilterInput } from './reports.types';

const CSV_HEADERS = [
  { label: 'Register Number', key: 'userId' },
  { label: 'Student Name', key: 'studentName' },
  { label: 'Admission Year', key: 'admissionYear' },
  { label: 'Section', key: 'section' },
  { label: 'OD Title', key: 'title' },
  { label: 'Location', key: 'location' },
  { label: 'From Date', key: 'fromDate' },
  { label: 'To Date', key: 'toDate' },
  { label: 'Events Count', key: 'numberOfEvents' },
  { label: 'Status', key: 'status' },
  { label: 'Submitted At', key: 'createdAt' },
];

export const generateGlobalReport = async (filters: ExportFilterInput): Promise<string> => {
  const whereClauses = [];

  if (filters.fromDate) {
    whereClauses.push(gte(odApplications.fromDate, filters.fromDate));
  }
  if (filters.toDate) {
    whereClauses.push(lte(odApplications.toDate, filters.toDate));
  }
  if (filters.section) {
    whereClauses.push(eq(students.section, filters.section));
  }
  if (filters.admissionYear) {
    whereClauses.push(eq(students.admissionYear, filters.admissionYear));
  }

  const rows = await db
    .select({
      userId: students.userId,
      studentName: students.fullName,
      admissionYear: students.admissionYear,
      section: students.section,
      title: odApplications.title,
      location: odApplications.location,
      fromDate: odApplications.fromDate,
      toDate: odApplications.toDate,
      numberOfEvents: odApplications.numberOfEvents,
      status: odApplications.status,
      createdAt: odApplications.createdAt,
    })
    .from(odApplications)
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(and(...whereClauses))
    .orderBy(odApplications.createdAt);

  const formattedRows = rows.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));

  return convertToCSV(formattedRows, CSV_HEADERS);
};

export const generateCohortReport = async (
  mentorUserId: string,
  filters: ExportFilterInput
): Promise<string> => {
  const whereClauses = [eq(students.mentorId, mentorUserId)];

  if (filters.fromDate) {
    whereClauses.push(gte(odApplications.fromDate, filters.fromDate));
  }
  if (filters.toDate) {
    whereClauses.push(lte(odApplications.toDate, filters.toDate));
  }
  if (filters.section) {
    whereClauses.push(eq(students.section, filters.section));
  }
  if (filters.admissionYear) {
    whereClauses.push(eq(students.admissionYear, filters.admissionYear));
  }

  const rows = await db
    .select({
      userId: students.userId,
      studentName: students.fullName,
      admissionYear: students.admissionYear,
      section: students.section,
      title: odApplications.title,
      location: odApplications.location,
      fromDate: odApplications.fromDate,
      toDate: odApplications.toDate,
      numberOfEvents: odApplications.numberOfEvents,
      status: odApplications.status,
      createdAt: odApplications.createdAt,
    })
    .from(odApplications)
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(and(...whereClauses))
    .orderBy(odApplications.createdAt);

  const formattedRows = rows.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));

  return convertToCSV(formattedRows, CSV_HEADERS);
};
