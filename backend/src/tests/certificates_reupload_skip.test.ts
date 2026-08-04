import { describe, it, expect } from 'vitest';
import { db } from '../db';
import { odApplications, certificateRequirements, users, students } from '../db/schema';
import { skipCertificateUpload, uploadCertificate, verifyCertificate } from '../modules/certificates/certificates.service';
import { getApplicationDetails } from '../modules/applications/applications.service';
import { eq } from 'drizzle-orm';

describe('Certificates Re-upload & Skip Integration Tests', () => {
  it('should allow skipping a certificate requirement without PostgreSQL enum errors', async () => {
    // 1. Setup test student & application
    const studentId = 'TEST_STUDENT_SKIP_01';

    await db.delete(users).where(eq(users.userId, studentId));
    await db.insert(users).values({
      userId: studentId,
      username: studentId,
      role: 'Student',
      passwordHash: 'hash',
    });
    await db.insert(students).values({
      userId: studentId,
      mentorId: 'MENTOR_01',
      fullName: 'Test Student',
      dateOfBirth: '2003-01-01',
      admissionYear: 2023,
      section: 'A',
    });

    const [app] = await db
      .insert(odApplications)
      .values({
        studentId,
        title: 'Skip Test Event',
        institutionName: 'Hall A',
        fromDate: '2020-01-01',
        toDate: '2020-01-02',
        numberOfEvents: 1,
        status: 'Approved',
      })
      .returning();

    const [req] = await db
      .insert(certificateRequirements)
      .values({
        applicationId: app.applicationId,
        sequenceNumber: 1,
        status: 'Pending Upload',
        submissionDeadline: '2099-01-01',
      })
      .returning();

    // 2. Skip upload
    const result = await skipCertificateUpload(studentId, req.requirementId);
    expect(result.status).toBe('Skipped');

    // 3. Verify in database
    const [updatedReq] = await db
      .select()
      .from(certificateRequirements)
      .where(eq(certificateRequirements.requirementId, req.requirementId));

    expect(updatedReq.status).toBe('Skipped');
  });

  it('should return exactly 1 active certificate requirement item when a rejected certificate is re-uploaded', async () => {
    // 1. Setup test student & application
    const studentId = 'TEST_STUDENT_REUPLOAD_01';

    await db.delete(users).where(eq(users.userId, studentId));
    await db.insert(users).values({
      userId: studentId,
      username: studentId,
      role: 'Student',
      passwordHash: 'hash',
    });
    await db.insert(students).values({
      userId: studentId,
      mentorId: 'MENTOR_01',
      fullName: 'Test Reupload Student',
      dateOfBirth: '2003-01-01',
      admissionYear: 2023,
      section: 'B',
    });

    const [app] = await db
      .insert(odApplications)
      .values({
        studentId,
        title: 'Reupload Test Event',
        institutionName: 'Hall B',
        fromDate: '2020-01-01',
        toDate: '2020-01-02',
        numberOfEvents: 1,
        status: 'Approved',
      })
      .returning();

    const [req] = await db
      .insert(certificateRequirements)
      .values({
        applicationId: app.applicationId,
        sequenceNumber: 1,
        status: 'Pending Upload',
        submissionDeadline: '2099-01-01',
      })
      .returning();

    // 2. Upload version 1
    const mockFile = {
      fieldname: 'file',
      originalname: 'cert_v1.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 mock cert v1'),
      size: 100,
    } as Express.Multer.File;

    await uploadCertificate(studentId, { requirementId: req.requirementId.toString() }, mockFile);

    // 3. EC rejects version 1
    await verifyCertificate(req.requirementId, {
      status: 'Rejected',
      comments: 'Blurry document',
    });

    // 4. Upload version 2 (re-upload)
    const mockFileV2 = {
      fieldname: 'file',
      originalname: 'cert_v2.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 mock cert v2'),
      size: 120,
    } as Express.Multer.File;

    await uploadCertificate(studentId, { requirementId: req.requirementId.toString() }, mockFileV2);

    // 5. Fetch application details
    const appDetails = await getApplicationDetails(app.applicationId, studentId, 'Student');

    // Should return EXACTLY 1 certificate item for sequence 1, with uploadVersion 2 & isCurrent true
    expect(appDetails.certificates).toHaveLength(1);
    expect(appDetails.certificates[0].uploadVersion).toBe(2);
    expect(appDetails.certificates[0].isCurrent).toBe(true);
  });
});
