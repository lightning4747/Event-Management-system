import { db } from '../../db';
import { odApplications, students } from '../../db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { convertToCSV } from '../../utils/csv';
import { ExportFilterInput } from './reports.types';

const CSV_HEADERS = [
  { label: 'S.No', key: 'sNo' },
  { label: 'Department', key: 'department' },
  { label: 'Academic Year', key: 'academicYear' },
  { label: 'Name of the Student', key: 'studentName' },
  { label: 'Roll No', key: 'rollNo' },
  { label: 'Name of the Event', key: 'eventName' },
  { label: 'Type of the Event', key: 'eventType' },
  { label: 'Date of Participation (DD-MM-YYYY)', key: 'dateOfParticipation' },
];

const formatDateDDMMYYYY = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

const formatAcademicYear = (admissionYear: number): string => {
  if (!admissionYear) return '';
  return `${admissionYear}-${admissionYear + 1}`;
};

const formatParticipationDate = (fromDate: string, toDate: string): string => {
  const formattedFrom = formatDateDDMMYYYY(fromDate);
  const formattedTo = formatDateDDMMYYYY(toDate);
  if (!formattedFrom) return '';
  if (!formattedTo || formattedFrom === formattedTo) return formattedFrom;
  return `${formattedFrom} to ${formattedTo}`;
};

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
  if (filters.activityCategory) {
    whereClauses.push(eq(odApplications.activityCategory, filters.activityCategory));
  }
  if (filters.activityType) {
    whereClauses.push(eq(odApplications.activityType, filters.activityType));
  }

  const rows = await db
    .select({
      userId: students.userId,
      studentName: students.fullName,
      admissionYear: students.admissionYear,
      title: odApplications.title,
      activityType: odApplications.activityType,
      fromDate: odApplications.fromDate,
      toDate: odApplications.toDate,
    })
    .from(odApplications)
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(and(...whereClauses))
    .orderBy(odApplications.createdAt);

  const formattedRows = rows.map((r, index) => ({
    sNo: index + 1,
    department: 'AI&DS',
    academicYear: formatAcademicYear(r.admissionYear),
    studentName: r.studentName,
    rollNo: r.userId,
    eventName: r.title,
    eventType: r.activityType,
    dateOfParticipation: formatParticipationDate(r.fromDate, r.toDate),
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
  if (filters.activityCategory) {
    whereClauses.push(eq(odApplications.activityCategory, filters.activityCategory));
  }
  if (filters.activityType) {
    whereClauses.push(eq(odApplications.activityType, filters.activityType));
  }

  const rows = await db
    .select({
      userId: students.userId,
      studentName: students.fullName,
      admissionYear: students.admissionYear,
      title: odApplications.title,
      activityType: odApplications.activityType,
      fromDate: odApplications.fromDate,
      toDate: odApplications.toDate,
    })
    .from(odApplications)
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(and(...whereClauses))
    .orderBy(odApplications.createdAt);

  const formattedRows = rows.map((r, index) => ({
    sNo: index + 1,
    department: 'AI&DS',
    academicYear: formatAcademicYear(r.admissionYear),
    studentName: r.studentName,
    rollNo: r.userId,
    eventName: r.title,
    eventType: r.activityType,
    dateOfParticipation: formatParticipationDate(r.fromDate, r.toDate),
  }));

  return convertToCSV(formattedRows, CSV_HEADERS);
};
