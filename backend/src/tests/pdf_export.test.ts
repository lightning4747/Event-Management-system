import { describe, it, expect, beforeEach } from 'vitest';
import { clearDatabase, seedTestUsers } from './setup';
import { createApplication } from '../modules/applications/applications.service';
import { generateApplicationPdf } from '../modules/applications/pdf.service';
import { db } from '../db';
import { odApplications } from '../db/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '../lib/errors';

describe('Export Approved OD Application as PDF Integration Tests', () => {
  beforeEach(async () => {
    await clearDatabase();
    await seedTestUsers();
  });

  it('allows owner student to export PDF for a fully Approved application', async () => {
    // Create application
    const app = await createApplication({
      title: 'Approved Tech Conference 2026',
      institutionName: 'PSG Tech',
      fromDate: '2026-09-10',
      toDate: '2026-09-12',
      numberOfEvents: 1,
    }, 'STUDENT_01');

    // Force status to Approved
    await db.update(odApplications)
      .set({ status: 'Approved' })
      .where(eq(odApplications.applicationId, app.applicationId));

    const pdfBuffer = await generateApplicationPdf(app.applicationId, 'STUDENT_01');
    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
  });

  it('blocks PDF export for applications that are NOT fully approved (e.g. In Progress)', async () => {
    const app = await createApplication({
      title: 'Pending Hackathon 2026',
      institutionName: 'IIT Madras',
      fromDate: '2026-10-01',
      toDate: '2026-10-02',
      numberOfEvents: 1,
    }, 'STUDENT_01');

    try {
      await generateApplicationPdf(app.applicationId, 'STUDENT_01');
      expect.unreachable('Should have thrown AppError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('APPLICATION_NOT_APPROVED');
    }
  });

  it('blocks students from exporting another student application PDF', async () => {
    const app = await createApplication({
      title: 'Approved Tech Conference 2026',
      institutionName: 'PSG Tech',
      fromDate: '2026-09-10',
      toDate: '2026-09-12',
      numberOfEvents: 1,
    }, 'STUDENT_01');

    await db.update(odApplications)
      .set({ status: 'Approved' })
      .where(eq(odApplications.applicationId, app.applicationId));

    try {
      await generateApplicationPdf(app.applicationId, 'STUDENT_02');
      expect.unreachable('Should have thrown AppError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('FORBIDDEN');
    }
  });
});

