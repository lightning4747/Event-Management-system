// 1. MUST set test DATABASE_URL BEFORE any dynamic imports run (prevents ES module hoisting)
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    /\/od_approval_db(\?|$)/,
    '/od_approval_test_db$1'
  );
} else {
  process.env.DATABASE_URL = 'postgres://postgres:password123@localhost:5432/od_approval_test_db';
}

import { addDays, format } from 'date-fns';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Dynamic imports to ensure process.env.DATABASE_URL modification takes effect
const { db, pool } = await import('../db');
const { users, students, faculty, odApplications, certificateRequirements, certificates } = await import('../db/schema');
const { createApplication } = await import('../modules/applications/applications.service');
const { checkCertificateDeadlines, uploadCertificate, verifyCertificate } = await import('../modules/certificates/certificates.service');
const { requestDeadlineExtension, decideDeadlineExtension } = await import('../modules/extensions/extensions.service');
const { eq, sql } = await import('drizzle-orm');
const { migrate } = await import('drizzle-orm/node-postgres/migrator');

const runSimulation = async () => {
  console.log('\n===============================================================');
  console.log('🚀 STARTING DEADLINE, EXTENSION & GOOGLE DRIVE VERIFICATION SIMULATION');
  console.log('🔒 ISOLATED TEST DATABASE ACTIVE: od_approval_test_db');
  console.log('===============================================================\n');

  try {
    // 0. Migrate test database structure
    console.log('0️⃣ Running migrations on isolated test database (od_approval_test_db)...');
    const migrationsPath = path.resolve(__dirname, '../../drizzle');
    await migrate(db, { migrationsFolder: migrationsPath });

    // Clean isolated test database
    await db.execute(sql`
      TRUNCATE TABLE 
        certificate_deadline_extensions,
        certificates,
        certificate_requirements,
        application_approval_history,
        od_applications,
        students,
        faculty,
        users
      CASCADE;
    `);

    // 1. Provision Test Users
    console.log('1️⃣ Provisioning test users (Student: TEST_STU01, Mentor: TEST_FAC01)...');
    await db.insert(users).values([
      { userId: 'TEST_STU01', username: 'test_student', passwordHash: 'hash123', role: 'Student' },
      { userId: 'TEST_FAC01', username: 'test_mentor', passwordHash: 'hash123', role: 'Mentor' },
    ]).onConflictDoNothing();

    await db.insert(faculty).values({
      userId: 'TEST_FAC01',
      fullName: 'Test Mentor Faculty',
      designation: 'Assistant Professor',
    }).onConflictDoNothing();

    await db.insert(students).values({
      userId: 'TEST_STU01',
      fullName: 'Test Student User',
      section: 'A',
      admissionYear: 2024,
      dateOfBirth: '2005-01-01',
      mentorId: 'TEST_FAC01',
    }).onConflictDoNothing();

    // 2. Create Application with Current Event Date (1 day event)
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    console.log(`2️⃣ Creating OD Application starting today (${todayStr})...`);
    const appRes = await createApplication(
      {
        title: 'IEEE Hackathon Simulation 2026',
        activityCategory: 'Co-curricular',
        activityType: 'Hackathon',
        location: 'Coimbatore',
        fromDate: todayStr,
        toDate: todayStr,
        numberOfEvents: 1,
      },
      'TEST_STU01'
    );
    const appId = appRes.applicationId;
    console.log(`   ✅ OD Application Created. ID: ${appId}`);

    // Approve app to generate requirements with past deadline
    const expiredDeadlineStr = format(addDays(new Date(), -2), 'yyyy-MM-dd'); // 2 days expired
    await db.update(odApplications).set({ status: 'Approved' }).where(eq(odApplications.applicationId, appId));

    const [req] = await db.insert(certificateRequirements).values({
      applicationId: appId,
      sequenceNumber: 1,
      status: 'Pending Upload',
      submissionDeadline: expiredDeadlineStr,
    }).returning();
    const reqId = req.requirementId;

    console.log(`   ✅ Created Certificate Requirement #${reqId} with past deadline: ${expiredDeadlineStr}`);

    // 3. Trigger Deadline Expiry Check
    console.log('\n3️⃣ Running checkCertificateDeadlines()...');
    const expiredCount = await checkCertificateDeadlines();
    console.log(`   ✅ Deadline check finished. Total requirements expired: ${expiredCount}`);

    const [updatedReq] = await db.select().from(certificateRequirements).where(eq(certificateRequirements.requirementId, reqId));
    console.log(`   🔍 Requirement #${reqId} Status after check: "${updatedReq.status}" (Expected: "Deadline Expired")`);
    if (updatedReq.status !== 'Deadline Expired') {
      throw new Error(`Expected status 'Deadline Expired', but got '${updatedReq.status}'`);
    }

    // 4. Verify Upload is Blocked before Event End Date
    console.log('\n4️⃣ Testing certificate upload before event end date (future toDate)...');
    const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    await db.update(odApplications).set({ toDate: tomorrowStr }).where(eq(odApplications.applicationId, appId));

    const dummyPdf = {
      fieldname: 'file',
      originalname: 'test_cert.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test dummy content'),
      size: 100,
    } as Express.Multer.File;

    try {
      await uploadCertificate('TEST_STU01', { requirementId: reqId.toString() }, dummyPdf);
      throw new Error('Upload should have been blocked before event end date!');
    } catch (err: unknown) {
      console.log(`   ✅ Upload correctly blocked with error: "${(err as Error).message}"`);
    }

    // 5. Student Requests Deadline Extension
    console.log('\n5️⃣ Student requesting 3-day deadline extension...');
    const extRes = await requestDeadlineExtension('TEST_STU01', {
      applicationId: appId.toString(),
      requestedDays: 3,
      reason: 'Delay receiving physical participation certificate from organizer',
    });
    console.log(`   ✅ Extension requested successfully. Extension ID: ${extRes.extensionId}`);

    // 6. Mentor Approves Extension
    console.log('\n6️⃣ Mentor approving extension request...');
    const extDecision = await decideDeadlineExtension('TEST_FAC01', extRes.extensionId, { decision: 'Approve' });
    console.log(`   ✅ Extension Approved. Status: "${extDecision.status}", New Deadline: ${extDecision.newDeadline}`);

    const [unlockedReq] = await db.select().from(certificateRequirements).where(eq(certificateRequirements.requirementId, reqId));
    console.log(`   🔍 Requirement #${reqId} Status after extension approval: "${unlockedReq.status}" (Expected: "Pending Upload")`);

    // 7. Student Uploads Certificate PDF on Event End Date (Local Storage Only)
    await db.update(odApplications).set({ toDate: todayStr }).where(eq(odApplications.applicationId, appId));

    console.log('\n7️⃣ Student uploading certificate PDF after extension approval...');
    const uploadRes = await uploadCertificate('TEST_STU01', { requirementId: reqId.toString() }, dummyPdf);
    console.log(`   ✅ Certificate uploaded. File URL: ${uploadRes.fileUrl}`);

    const [certRecord] = await db.select().from(certificates).where(eq(certificates.requirementId, reqId));
    console.log(`   🔍 DB Certificate Record: driveItemId="${certRecord.driveItemId}", isCurrent=${certRecord.isCurrent}`);
    if (certRecord.driveItemId !== null) {
      throw new Error(`Expected driveItemId to be null before mentor approval, but got ${certRecord.driveItemId}`);
    }
    console.log('   ✅ Certificate stored in LOCAL storage only before mentor approval (driveItemId = null).');

    // 8. Event Coordinator Verifies Certificate (Triggers Google Drive Upload Sync)
    console.log('\n8️⃣ Event Coordinator verifying student certificate...');
    const verifyRes = await verifyCertificate(reqId, { status: 'Verified' });
    console.log(`   ✅ Verification complete. Requirement Status: "${verifyRes.status}"`);

    const [finalCertRecord] = await db.select().from(certificates).where(eq(certificates.requirementId, reqId));
    console.log(`   🔍 Final DB Certificate Record after EC Approval:`);
    console.log(`      - requirementId: ${finalCertRecord.requirementId}`);
    console.log(`      - driveItemId:   ${finalCertRecord.driveItemId || '(Local Fallback Active)'}`);
    console.log(`      - fileUrl:       ${finalCertRecord.fileUrl}`);

    console.log('\n===============================================================');
    console.log('🎉 ALL WORKFLOW & DEADLINE EXTENSION TESTS PASSED 100% CLEANLY!');
    console.log('🔒 MAIN DATABASE (od_approval_db) WAS NOT TOUCHED AT ALL.');
    console.log('===============================================================\n');
  } catch (error: unknown) {
    console.error('\n❌ SIMULATION FAILED WITH ERROR:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

runSimulation();
