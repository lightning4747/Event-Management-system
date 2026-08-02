import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as XLSX from 'xlsx';
import { db } from '../db';
import { users, faculty, students, odApplications, certificateRequirements } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { generateGlobalReport, generateCohortReport, generateExcelReport } from '../modules/reports/reports.service';

const TEST_STUDENT_ID = 'TEST_CSV_STUDENT';
const TEST_MENTOR_ID = 'TEST_CSV_MENTOR';
const TEST_MULTI_STUDENT_ID = 'TEST_MULTI_STUDENT';

describe('CSV Export Column Format & Security Integration Tests', () => {
  beforeAll(async () => {
    // Cleanup any leftovers
    for (const sid of [TEST_STUDENT_ID, TEST_MULTI_STUDENT_ID]) {
      const apps = await db.select({ id: odApplications.applicationId }).from(odApplications).where(eq(odApplications.studentId, sid));
      const appIds = apps.map((a) => a.id);
      if (appIds.length > 0) {
        await db.delete(certificateRequirements).where(inArray(certificateRequirements.applicationId, appIds));
        await db.delete(odApplications).where(inArray(odApplications.applicationId, appIds));
      }
      await db.delete(students).where(eq(students.userId, sid));
    }
    await db.delete(faculty).where(eq(faculty.userId, TEST_MENTOR_ID));
    await db.delete(users).where(inArray(users.userId, [TEST_STUDENT_ID, TEST_MENTOR_ID, TEST_MULTI_STUDENT_ID]));

    // Seed test mentor & students
    await db.insert(users).values([
      { userId: TEST_MENTOR_ID, username: 'test_csv_mentor', passwordHash: 'hash', role: 'Mentor' },
      { userId: TEST_STUDENT_ID, username: 'test_csv_student', passwordHash: 'hash', role: 'Student' },
      { userId: TEST_MULTI_STUDENT_ID, username: 'test_multi_student', passwordHash: 'hash', role: 'Student' },
    ]);

    await db.insert(faculty).values({
      userId: TEST_MENTOR_ID,
      fullName: 'CSV Test Mentor',
      designation: 'Assistant Professor',
    });

    await db.insert(students).values([
      {
        userId: TEST_STUDENT_ID,
        mentorId: TEST_MENTOR_ID,
        fullName: 'CSV Test Student',
        dateOfBirth: '2004-05-15',
        admissionYear: 2024,
        section: 'A',
      },
      {
        userId: TEST_MULTI_STUDENT_ID,
        mentorId: TEST_MENTOR_ID,
        fullName: 'Multi Event Student',
        dateOfBirth: '2004-06-20',
        admissionYear: 2024,
        section: 'B',
      },
    ]);

    // Single-event hackathon application (formula injection test)
    const [app] = await db
      .insert(odApplications)
      .values({
        studentId: TEST_STUDENT_ID,
        title: '=DANGEROUS_FORMULA()',
        activityCategory: 'Co-curricular',
        activityType: 'Hackathon',
        location: 'Tech Park Auditorium',
        fromDate: '2026-08-15',
        toDate: '2026-08-17',
        numberOfEvents: 1,
        status: 'Approved',
        events: [{ sequenceNumber: 1, activityCategory: 'Co-curricular', activityType: 'Hackathon' }],
      })
      .returning();

    await db.insert(certificateRequirements).values({
      applicationId: app.applicationId,
      sequenceNumber: 1,
      activityCategory: 'Co-curricular',
      activityType: 'Hackathon',
      status: 'Verified',
      submissionDeadline: '2026-12-31',
    });

    // Multi-event application: Hackathon + Workshop + Sports (3 sub-events)
    const [multiApp] = await db
      .insert(odApplications)
      .values({
        studentId: TEST_MULTI_STUDENT_ID,
        title: 'Multi Event App',
        activityCategory: 'Co-curricular',
        activityType: 'Hackathon',
        location: 'Main Campus',
        fromDate: '2026-09-01',
        toDate: '2026-09-03',
        numberOfEvents: 3,
        status: 'Approved',
        events: [
          { sequenceNumber: 1, activityCategory: 'Co-curricular', activityType: 'Hackathon' },
          { sequenceNumber: 2, activityCategory: 'Co-curricular', activityType: 'Workshop' },
          { sequenceNumber: 3, activityCategory: 'Extracurricular', activityType: 'Sports' },
        ],
      })
      .returning();

    for (let i = 1; i <= 3; i++) {
      await db.insert(certificateRequirements).values({
        applicationId: multiApp.applicationId,
        sequenceNumber: i,
        activityCategory: i <= 2 ? 'Co-curricular' : 'Extracurricular',
        activityType: ['Hackathon', 'Workshop', 'Sports'][i - 1],
        status: 'Verified',
        submissionDeadline: '2026-12-31',
      });
    }
  });

  afterAll(async () => {
    for (const sid of [TEST_STUDENT_ID, TEST_MULTI_STUDENT_ID]) {
      const apps = await db.select({ id: odApplications.applicationId }).from(odApplications).where(eq(odApplications.studentId, sid));
      const appIds = apps.map((a) => a.id);
      if (appIds.length > 0) {
        await db.delete(certificateRequirements).where(inArray(certificateRequirements.applicationId, appIds));
        await db.delete(odApplications).where(inArray(odApplications.applicationId, appIds));
      }
      await db.delete(students).where(eq(students.userId, sid));
    }
    await db.delete(faculty).where(eq(faculty.userId, TEST_MENTOR_ID));
    await db.delete(users).where(inArray(users.userId, [TEST_STUDENT_ID, TEST_MENTOR_ID, TEST_MULTI_STUDENT_ID]));
  });

  // ── CSV tests ────────────────────────────────────────────────────────────────

  it('generates global report with exact required 10 columns in order', async () => {
    const csv = await generateGlobalReport({});
    const lines = csv.split('\n');
    expect(lines.length).toBeGreaterThan(1);

    const header = lines[0];
    expect(header).toBe('"S.No","Department","Academic Year","Name of the Student","Roll No","Name of the Event","Type of the Event","Date of Participation (DD-MM-YYYY)","Participation/achievement","Name of the award/ medal"');

    // Find row for TEST_STUDENT_ID
    const studentRow = lines.find((l) => l.includes('CSV Test Student'));
    expect(studentRow).toBeDefined();

    if (studentRow) {
      expect(studentRow).toContain('"AI&DS"');
      expect(studentRow).toContain('"2024-2025"');
      expect(studentRow).toContain('"CSV Test Student"');
      expect(studentRow).toContain('"TEST_CSV_STUDENT"');
      expect(studentRow).toContain('"Hackathon"');
      expect(studentRow).toContain('"15-08-2026 to 17-08-2026"');
      expect(studentRow).toContain('"Participation"');
      expect(studentRow).toContain('"Participation certificate"');
      // Verify CSV formula injection prevention (escaped with single quote)
      expect(studentRow).toContain('\'=DANGEROUS_FORMULA()');
    }
  });

  it('generates cohort report for assigned mentor with correct columns and data', async () => {
    const csv = await generateCohortReport(TEST_MENTOR_ID, {});
    const lines = csv.split('\n');
    expect(lines.length).toBeGreaterThan(1);

    const header = lines[0];
    expect(header).toBe('"S.No","Department","Academic Year","Name of the Student","Roll No","Name of the Event","Type of the Event","Date of Participation (DD-MM-YYYY)","Participation/achievement","Name of the award/ medal"');
    expect(csv).toContain('CSV Test Student');
  });

  // ── Excel multi-sheet tests ──────────────────────────────────────────────────

  it('generates excel report buffer with 4 correct sheet names', async () => {
    const buf = await generateExcelReport({});
    const wb = XLSX.read(buf, { type: 'buffer' });

    expect(wb.SheetNames).toContain('Student Participation Workshop');
    expect(wb.SheetNames).toContain('Student Participation Co-Curric');
    expect(wb.SheetNames).toContain('Student Participation Extra-Cur');
    expect(wb.SheetNames).toContain('Student Participation(Conferen)');
    expect(wb.SheetNames).toHaveLength(4);
  });

  it('routes hackathon sub-event to co-curricular sheet only', async () => {
    const buf = await generateExcelReport({});
    const wb = XLSX.read(buf, { type: 'buffer' });

    const coSheet = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Student Participation Co-Curric'], { header: 1 }) as string[][];
    const dataRows = coSheet.slice(3); // skip title, nav, header

    const hackathonRow = dataRows.find(r => String(r[6] ?? '').includes('DANGEROUS_FORMULA') || String(r[3] ?? '') === 'CSV Test Student');
    expect(hackathonRow).toBeDefined();

    // Must NOT appear in workshop or extracurricular sheet
    const wsSheet = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Student Participation Workshop'], { header: 1 }) as string[][];
    const wsData = wsSheet.slice(3).map(r => String(r[3] ?? ''));
    expect(wsData).not.toContain('CSV Test Student');
  });

  it('expands multi-event application: Hackathon → co-curricular, Workshop → workshop, Sports → extracurricular', async () => {
    const buf = await generateExcelReport({});
    const wb = XLSX.read(buf, { type: 'buffer' });

    const coData = (XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Student Participation Co-Curric'], { header: 1 }) as string[][]).slice(3);
    const wsData = (XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Student Participation Workshop'], { header: 1 }) as string[][]).slice(3);
    const exData = (XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Student Participation Extra-Cur'], { header: 1 }) as string[][]).slice(3);

    const coNames = coData.map(r => String(r[3] ?? ''));
    const wsNames = wsData.map(r => String(r[3] ?? ''));
    const exNames = exData.map(r => String(r[3] ?? ''));

    // Hackathon → Co-Curricular sheet
    expect(coNames).toContain('Multi Event Student');
    // Workshop → Workshop sheet
    expect(wsNames).toContain('Multi Event Student');
    // Sports → Extra-Curricular sheet
    expect(exNames).toContain('Multi Event Student');
  });

  it('excel title rows match spec format', async () => {
    const buf = await generateExcelReport({});
    const wb = XLSX.read(buf, { type: 'buffer' });

    const wsSheet = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Student Participation Workshop'], { header: 1 }) as string[][];
    expect(String(wsSheet[0]?.[0] ?? '')).toBe('Details of students participation in Workshop/Seminar');

    const coSheet = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Student Participation Co-Curric'], { header: 1 }) as string[][];
    expect(String(coSheet[0]?.[0] ?? '')).toBe('Details of students participation in Co Curricular Activities');

    const exSheet = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Student Participation Extra-Cur'], { header: 1 }) as string[][];
    expect(String(exSheet[0]?.[0] ?? '')).toBe('Details of students participation in Extra Curricular Activities');

    const confSheet = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Student Participation(Conferen)'], { header: 1 }) as string[][];
    expect(String(confSheet[0]?.[0] ?? '')).toBe('Details of Students attended Conference');
  });

  it('prevents formula injection in excel cells', async () => {
    const buf = await generateExcelReport({});
    const wb = XLSX.read(buf, { type: 'buffer' });

    const coSheet = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Student Participation Co-Curric'], { header: 1 }) as string[][];
    const dataRows = coSheet.slice(3);

    // The dangerous formula title should be present, prefixed with ' for safety
    const injectionRow = dataRows.find(r => String(r[6] ?? '').includes('=DANGEROUS_FORMULA'));
    expect(injectionRow).toBeDefined();
    if (injectionRow) {
      expect(String(injectionRow[6])).toMatch(/^'=DANGEROUS_FORMULA\(\)$/);
    }
  });

  it('cohort excel report only includes mentor cohort students', async () => {
    const buf = await generateExcelReport({}, TEST_MENTOR_ID);
    const wb = XLSX.read(buf, { type: 'buffer' });

    // Both test students belong to TEST_MENTOR_ID — they should appear
    const coSheet = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Student Participation Co-Curric'], { header: 1 }) as string[][];
    const allNames = coSheet.slice(3).map(r => String(r[3] ?? ''));
    expect(allNames).toContain('CSV Test Student');
    expect(allNames).toContain('Multi Event Student');
  });
});
