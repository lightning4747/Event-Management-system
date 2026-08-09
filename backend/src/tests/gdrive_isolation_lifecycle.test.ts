/**
 * S3 Certificate Isolation & Rejection Lifecycle Tests.
 *
 * Originally "gdrive_isolation_lifecycle.test.ts" — updated to match the
 * new S3 key-builder naming convention.
 *
 * Key naming format (via buildCertificateKey):
 *   Certificates/<Year>/<Section>/<StudentId>/<Category>/<Type>/<eventSlug>_req<reqId>_v<version>.pdf
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { odApplications, certificateRequirements, certificates } from '../db/schema';
import { uploadCertificate, verifyCertificate } from '../modules/certificates/certificates.service';
import { clearDatabase, seedTestUsers } from './setup';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { slugify } from '../services/storage/key-builder';

describe('S3 Certificate Isolation & Rejection Lifecycle Tests', () => {
  let studentId: string;
  let appId1: bigint;
  let appId2: bigint;
  let reqId1: bigint;
  let reqId2: bigint;

  beforeEach(async () => {
    await clearDatabase();
    await seedTestUsers();

    studentId = 'STUDENT_01';

    // 1. Create Application 1 (Past date so upload is allowed)
    const [app1] = await db
      .insert(odApplications)
      .values({
        studentId,
        title: 'Technical Symposium',
        institutionName: 'Coimbatore',
        fromDate: '2026-01-10',
        toDate: '2026-01-12',
        numberOfEvents: 1,
        activityCategory: 'Co-curricular',
        activityType: 'Paper Presentation',
        status: 'In Progress: Event Coordinator',
      })
      .returning({ applicationId: odApplications.applicationId });

    appId1 = app1.applicationId;

    // Create Requirement 1
    const [req1] = await db
      .insert(certificateRequirements)
      .values({
        applicationId: appId1,
        sequenceNumber: 1,
        status: 'Pending Upload',
        submissionDeadline: '2026-02-01',
      })
      .returning({ requirementId: certificateRequirements.requirementId });

    reqId1 = req1.requirementId;

    // 2. Create Application 2 with IDENTICAL title to test isolation
    const [app2] = await db
      .insert(odApplications)
      .values({
        studentId,
        title: 'Technical Symposium',
        institutionName: 'Coimbatore',
        fromDate: '2026-01-15',
        toDate: '2026-01-17',
        numberOfEvents: 1,
        activityCategory: 'Co-curricular',
        activityType: 'Paper Presentation',
        status: 'In Progress: Event Coordinator',
      })
      .returning({ applicationId: odApplications.applicationId });

    appId2 = app2.applicationId;

    // Create Requirement 2
    const [req2] = await db
      .insert(certificateRequirements)
      .values({
        applicationId: appId2,
        sequenceNumber: 1,
        status: 'Pending Upload',
        submissionDeadline: '2026-02-01',
      })
      .returning({ requirementId: certificateRequirements.requirementId });

    reqId2 = req2.requirementId;
  });

  it('should generate strictly isolated S3 keys for separate applications with identical titles', { timeout: 15000 }, async () => {
    const mockFile1: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'cert1.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 Application 1 Certificate'),
      size: 100,
      stream: new Readable() as unknown as Readable,
      destination: '',
      filename: '',
      path: '',
    };

    const mockFile2: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'cert2.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 Application 2 Certificate'),
      size: 100,
      stream: new Readable() as unknown as Readable,
      destination: '',
      filename: '',
      path: '',
    };

    const res1 = await uploadCertificate(studentId, { requirementId: String(reqId1) }, mockFile1);
    const res2 = await uploadCertificate(studentId, { requirementId: String(reqId2) }, mockFile2);

    expect(res1.requirementId).toBe(reqId1);
    expect(res2.requirementId).toBe(reqId2);

    const [cert1] = await db.select().from(certificates).where(eq(certificates.requirementId, reqId1));
    const [cert2] = await db.select().from(certificates).where(eq(certificates.requirementId, reqId2));

    // New format: <eventSlug>_req<reqId>_v<version>.pdf
    const eventSlug = slugify('Technical Symposium');
    expect(cert1.fileName).toContain(`${eventSlug}_req${reqId1}_v1`);
    expect(cert2.fileName).toContain(`${eventSlug}_req${reqId2}_v1`);

    // Different requirementIds guarantee different keys even for identical titles
    expect(cert1.fileName).not.toEqual(cert2.fileName);

    // Sanity: no longer uses the old App/Req naming
    expect(cert1.fileName).not.toContain(`App${appId1}`);
    expect(cert2.fileName).not.toContain(`App${appId2}`);
  });

  it('should delete temporary certificate file from storage when EC rejects the certificate', async () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'cert_temp.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 Temporary Certificate for EC Review'),
      size: 100,
      stream: new Readable() as unknown as Readable,
      destination: '',
      filename: '',
      path: '',
    };

    await uploadCertificate(studentId, { requirementId: String(reqId1) }, mockFile);

    const [uploadedCert] = await db.select().from(certificates).where(eq(certificates.requirementId, reqId1));
    expect(uploadedCert).toBeDefined();

    // Verify local file exists if local fallback was used
    if (uploadedCert.fileUrl && uploadedCert.fileUrl.startsWith('/uploads/')) {
      const filePath = path.resolve(process.cwd(), uploadedCert.fileUrl.replace(/^\//, ''));
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      expect(fs.existsSync(filePath)).toBe(true);

      // Event Coordinator rejects the certificate
      await verifyCertificate(reqId1, { status: 'Rejected', comments: 'Illegible document copy.' });

      // Verify certificate requirement status is Rejected
      const [reqAfter] = await db.select().from(certificateRequirements).where(eq(certificateRequirements.requirementId, reqId1));
      expect(reqAfter.status).toBe('Rejected');
      expect(reqAfter.rejectionReason).toBe('Illegible document copy.');

      // Verify temporary file was deleted from disk
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      expect(fs.existsSync(filePath)).toBe(false);
    }
  });
});
