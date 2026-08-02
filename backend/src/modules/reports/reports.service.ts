import * as XLSX from 'xlsx';
import { db } from '../../db';
import { odApplications, students } from '../../db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { convertToCSV } from '../../utils/csv';
import { ExportFilterInput } from './reports.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SheetKey = 'workshop' | 'cocurricular' | 'extracurricular' | 'conference';

interface SubEventRow {
  // common fields across all sheets
  sNo: number;
  department: string;
  academicYear: string;
  studentName: string;
  rollNo: string;
  level: string;         // Inter-university / State / National / International
  eventName: string;
  eventType: string;
  internalExternal: string;
  participationOrAchievement: string;
  dateOfParticipation: string;
  organisingInstitute: string;
  clubCell: string;
  // co-curricular / extra-curricular only
  awardMedalName?: string;
  teamIndividual?: string;
  // conference only
  guideeName?: string;
  publicationThrough?: string;
  titlePaper?: string;
  participationType?: string;
  levelConference?: string;
  venue?: string;
  organisedBy?: string;
}

// ---------------------------------------------------------------------------
// Existing CSV helpers (preserved exactly)
// ---------------------------------------------------------------------------

const CSV_HEADERS = [
  { label: 'S.No', key: 'sNo' },
  { label: 'Department', key: 'department' },
  { label: 'Academic Year', key: 'academicYear' },
  { label: 'Name of the Student', key: 'studentName' },
  { label: 'Roll No', key: 'rollNo' },
  { label: 'Name of the Event', key: 'eventName' },
  { label: 'Type of the Event', key: 'eventType' },
  { label: 'Date of Participation (DD-MM-YYYY)', key: 'dateOfParticipation' },
  { label: 'Participation/achievement', key: 'participationOrAchievement' },
  { label: 'Name of the award/ medal', key: 'awardName' },
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

const getParticipationOrAchievement = (achievement?: string | null): string => {
  if (achievement && achievement !== 'Participation') {
    return 'Achievement';
  }
  return 'Participation';
};

const getAwardMedalName = (achievement?: string | null, awardName?: string | null): string => {
  if (awardName && awardName.trim()) {
    return awardName.trim();
  }
  if (achievement && achievement !== 'Participation') {
    return achievement;
  }
  return 'Participation certificate';
};

// ---------------------------------------------------------------------------
// Excel-specific helpers
// ---------------------------------------------------------------------------

/**
 * Prevents formula injection in Excel cells by prefixing trigger chars with '.
 * Applied to every string cell before writing to SheetJS.
 */
const sanitizeCell = (val: string): string => {
  const FORMULA_CHARS = ['=', '+', '-', '@', '\t', '\r'];
  if (val && FORMULA_CHARS.includes(val.charAt(0))) {
    return `'${val}`;
  }
  return val;
};

/**
 * Routes a sub-event to the correct Excel sheet based on activityCategory/activityType.
 * Option A (non-overlapping): Workshop/Seminar → workshop sheet only.
 */
const classifyToSheet = (category: string, type: string): SheetKey => {
  if (type === 'Conference') return 'conference';
  if (type === 'Seminar' || type === 'Workshop') return 'workshop';
  if (category === 'Extracurricular') return 'extracurricular';
  // Co-curricular and Others both fall here
  return 'cocurricular';
};

/**
 * Adds a sheet to the workbook with a title row, blank row, header row, then data rows.
 * Uses aoa_to_sheet (array-of-arrays) for maximum control over cell layout.
 */
const appendSheet = (
  wb: XLSX.WorkBook,
  sheetName: string,
  sheetTitle: string,
  columnLabels: string[],
  rows: SubEventRow[],
  columnKeys: (keyof SubEventRow)[],
): void => {
  const aoa: (string | number)[][] = [
    [sheetTitle],     // Row 1: title
    ['Home'],         // Row 2: nav stub (matches spec layout)
    columnLabels,     // Row 3: column headers
    ...rows.map(r =>
      columnKeys.map(k => {
        const raw = r[k];
        const val = raw === undefined || raw === null ? '' : String(raw);
        return sanitizeCell(val);
      })
    ),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
};

// ---------------------------------------------------------------------------
// Sheet column definitions
// ---------------------------------------------------------------------------

const WORKSHOP_COLUMNS: { label: string; key: keyof SubEventRow }[] = [
  { label: 'S.No', key: 'sNo' },
  { label: 'Department', key: 'department' },
  { label: 'Academic Year', key: 'academicYear' },
  { label: ' Name of the student', key: 'studentName' },
  { label: 'Roll No', key: 'rollNo' },
  { label: 'Inter-university / State / National / International', key: 'level' },
  { label: 'Name of the event', key: 'eventName' },
  { label: 'Type of the Event (Seminar/Workshop)', key: 'eventType' },
  { label: 'Internal/External', key: 'internalExternal' },
  { label: 'Participation/achievement', key: 'participationOrAchievement' },
  { label: 'Date of Participation (DD-MM-YYYY) ', key: 'dateOfParticipation' },
  { label: 'Name of the organising institute/ College', key: 'organisingInstitute' },
  { label: 'Name of the Club/Cell (if conducted via Clubs/Cells etc)', key: 'clubCell' },
];

const COCURRICULAR_COLUMNS: { label: string; key: keyof SubEventRow }[] = [
  { label: 'S.No', key: 'sNo' },
  { label: 'Department', key: 'department' },
  { label: 'Academic Year', key: 'academicYear' },
  { label: ' Name of the student', key: 'studentName' },
  { label: 'Roll No', key: 'rollNo' },
  { label: 'Inter-university / State / National / International', key: 'level' },
  { label: 'Name of the event', key: 'eventName' },
  { label: 'Type of the Event                              (Hackathon/training/Project competition/Symposium)', key: 'eventType' },
  { label: 'Internal/External', key: 'internalExternal' },
  { label: 'Participation/achievement', key: 'participationOrAchievement' },
  { label: 'Date of Participation (DD-MM-YYYY) ', key: 'dateOfParticipation' },
  { label: 'Name of the organising institute/ College', key: 'organisingInstitute' },
  { label: 'Name of the Club/Cell (if conducted via Clubs/Cells etc)', key: 'clubCell' },
  { label: 'Name of the award/ medal', key: 'awardMedalName' },
  { label: 'Team / Individual', key: 'teamIndividual' },
];

const EXTRACURRICULAR_COLUMNS: { label: string; key: keyof SubEventRow }[] = [
  { label: 'S.No', key: 'sNo' },
  { label: 'Department', key: 'department' },
  { label: 'Academic Year', key: 'academicYear' },
  { label: ' Name of the student', key: 'studentName' },
  { label: 'Roll No', key: 'rollNo' },
  { label: 'Inter-university / State / National / International', key: 'level' },
  { label: 'Name of the event', key: 'eventName' },
  { label: 'Type of the Event (Sports/Culturals)', key: 'eventType' },
  { label: 'Internal/External', key: 'internalExternal' },
  { label: 'Participation/achievement', key: 'participationOrAchievement' },
  { label: 'Date of Participation (DD-MM-YYYY) ', key: 'dateOfParticipation' },
  { label: 'Name of the organising institute/ College', key: 'organisingInstitute' },
  { label: 'Name of the Club/Cell (if conducted via Clubs/Cells etc)', key: 'clubCell' },
  { label: 'Name of the award/ medal', key: 'awardMedalName' },
  { label: 'Team / Individual', key: 'teamIndividual' },
];

const CONFERENCE_COLUMNS: { label: string; key: keyof SubEventRow }[] = [
  { label: 'S.No', key: 'sNo' },
  { label: 'Department', key: 'department' },
  { label: 'Academic Year', key: 'academicYear' },
  { label: 'Name of Student(s) who attended the programme\n', key: 'studentName' },
  { label: 'Roll No ', key: 'rollNo' },
  { label: 'Name of the Guide ', key: 'guideeName' },
  { label: 'Publication through Project/Internship/ training ', key: 'publicationThrough' },
  { label: 'Title of the Conference', key: 'eventName' },
  { label: 'Title of paper presented', key: 'titlePaper' },
  { label: 'Duration (from - to) (DD-MM-YYYY)', key: 'dateOfParticipation' },
  { label: 'Participation Type(Attended/Presented) ', key: 'participationType' },
  { label: 'Level of Conference (National/International)', key: 'levelConference' },
  { label: 'Venue', key: 'venue' },
  { label: 'Organised By', key: 'organisedBy' },
];

// ---------------------------------------------------------------------------
// DB query helpers (shared between global and cohort)
// ---------------------------------------------------------------------------

const buildWhereClauses = (filters: ExportFilterInput, mentorUserId?: string) => {
  const clauses: ReturnType<typeof eq>[] = [eq(odApplications.status, 'Approved')];

  if (mentorUserId) {
    clauses.push(eq(students.mentorId, mentorUserId));
  }
  if (filters.fromDate) {
    clauses.push(gte(odApplications.fromDate, filters.fromDate));
  }
  if (filters.toDate) {
    clauses.push(lte(odApplications.toDate, filters.toDate));
  }
  if (filters.section) {
    clauses.push(eq(students.section, filters.section));
  }
  if (filters.admissionYear) {
    clauses.push(eq(students.admissionYear, filters.admissionYear));
  }
  if (filters.activityCategory) {
    clauses.push(eq(odApplications.activityCategory, filters.activityCategory));
  }
  if (filters.activityType) {
    clauses.push(eq(odApplications.activityType, filters.activityType));
  }

  return clauses;
};

// ---------------------------------------------------------------------------
// Existing CSV exports (preserved exactly — no breaking changes)
// ---------------------------------------------------------------------------

export const generateGlobalReport = async (filters: ExportFilterInput): Promise<string> => {
  const whereClauses = buildWhereClauses(filters);

  const rows = await db
    .select({
      userId: students.userId,
      studentName: students.fullName,
      admissionYear: students.admissionYear,
      title: odApplications.title,
      activityType: odApplications.activityType,
      achievement: odApplications.achievement,
      awardName: odApplications.awardName,
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
    participationOrAchievement: getParticipationOrAchievement(r.achievement),
    awardName: getAwardMedalName(r.achievement, r.awardName),
  }));

  return convertToCSV(formattedRows, CSV_HEADERS);
};

export const generateCohortReport = async (
  mentorUserId: string,
  filters: ExportFilterInput
): Promise<string> => {
  const whereClauses = buildWhereClauses(filters, mentorUserId);

  const rows = await db
    .select({
      userId: students.userId,
      studentName: students.fullName,
      admissionYear: students.admissionYear,
      title: odApplications.title,
      activityType: odApplications.activityType,
      achievement: odApplications.achievement,
      awardName: odApplications.awardName,
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
    participationOrAchievement: getParticipationOrAchievement(r.achievement),
    awardName: getAwardMedalName(r.achievement, r.awardName),
  }));

  return convertToCSV(formattedRows, CSV_HEADERS);
};

// ---------------------------------------------------------------------------
// Excel multi-sheet export (new)
// ---------------------------------------------------------------------------

/**
 * Generates a multi-sheet .xlsx buffer matching the spec format.
 * Each OD application is expanded by its sub-events (events[] JSON column).
 * Each sub-event is routed to the appropriate sheet by activityCategory/activityType.
 *
 * @param filters - Standard export filters (date range, section, admissionYear, etc.)
 * @param mentorUserId - If provided, restricts to the mentor's cohort students.
 * @returns Buffer containing the .xlsx binary data.
 */
export const generateExcelReport = async (
  filters: ExportFilterInput,
  mentorUserId?: string
): Promise<Buffer> => {
  const whereClauses = buildWhereClauses(filters, mentorUserId);

  const rows = await db
    .select({
      userId: students.userId,
      studentName: students.fullName,
      admissionYear: students.admissionYear,
      title: odApplications.title,
      activityCategory: odApplications.activityCategory,
      activityType: odApplications.activityType,
      achievement: odApplications.achievement,
      awardName: odApplications.awardName,
      events: odApplications.events,
      location: odApplications.location,
      fromDate: odApplications.fromDate,
      toDate: odApplications.toDate,
    })
    .from(odApplications)
    .innerJoin(students, eq(odApplications.studentId, students.userId))
    .where(and(...whereClauses))
    .orderBy(odApplications.createdAt);

  // Sheet buckets: accumulate rows per sheet
  const buckets: Record<SheetKey, SubEventRow[]> = {
    workshop: [],
    cocurricular: [],
    extracurricular: [],
    conference: [],
  };

  // Sheet-level row counters (S.No resets per sheet)
  const counters: Record<SheetKey, number> = {
    workshop: 0,
    cocurricular: 0,
    extracurricular: 0,
    conference: 0,
  };

  for (const app of rows) {
    // Expand each application by its sub-events.
    // Fallback to top-level activityCategory/activityType if events[] is empty or null.
    const subEvents =
      app.events && app.events.length > 0
        ? app.events
        : [{ sequenceNumber: 1, activityCategory: app.activityCategory, activityType: app.activityType }];

    const dateOfParticipation = formatParticipationDate(app.fromDate, app.toDate);
    const academicYear = formatAcademicYear(app.admissionYear);

    for (const evt of subEvents) {
      const evtCategory = evt.activityCategory ?? app.activityCategory;
      const evtType = evt.activityType ?? app.activityType;
      const sheetKey = classifyToSheet(evtCategory, evtType);

      counters[sheetKey]++;

      const participationOrAchievement = getParticipationOrAchievement(app.achievement);
      const awardMedalName = getAwardMedalName(app.achievement, app.awardName);

      const row: SubEventRow = {
        sNo: counters[sheetKey],
        department: 'AI&DS',
        academicYear,
        studentName: app.studentName,
        rollNo: app.userId,
        level: app.location ?? '',              // "Inter-university / State / National / International"
        eventName: app.title,
        eventType: evtType,
        internalExternal: '',                   // not stored in schema
        participationOrAchievement,
        dateOfParticipation,
        organisingInstitute: app.location ?? '', // "Name of the organising institute/ College"
        clubCell: '',                            // not stored in schema
        awardMedalName,
        teamIndividual: '',                      // not stored in schema
        // Conference-specific fields
        guideeName: '',
        publicationThrough: '',
        titlePaper: '',
        participationType: participationOrAchievement,
        levelConference: app.location ?? '',
        venue: app.location ?? '',
        organisedBy: '',
      };

      buckets[sheetKey].push(row);
    }
  }

  // Build the workbook
  const wb = XLSX.utils.book_new();

  appendSheet(
    wb,
    'Student Participation Workshop',
    'Details of students participation in Workshop/Seminar',
    WORKSHOP_COLUMNS.map(c => c.label),
    buckets.workshop,
    WORKSHOP_COLUMNS.map(c => c.key),
  );

  appendSheet(
    wb,
    'Student Participation Co-Curric',
    'Details of students participation in Co Curricular Activities',
    COCURRICULAR_COLUMNS.map(c => c.label),
    buckets.cocurricular,
    COCURRICULAR_COLUMNS.map(c => c.key),
  );

  appendSheet(
    wb,
    'Student Participation Extra-Cur',
    'Details of students participation in Extra Curricular Activities',
    EXTRACURRICULAR_COLUMNS.map(c => c.label),
    buckets.extracurricular,
    EXTRACURRICULAR_COLUMNS.map(c => c.key),
  );

  appendSheet(
    wb,
    'Student Participation(Conferen)',
    'Details of Students attended Conference',
    CONFERENCE_COLUMNS.map(c => c.label),
    buckets.conference,
    CONFERENCE_COLUMNS.map(c => c.key),
  );

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
};
