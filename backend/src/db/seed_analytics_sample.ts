import { db, pool } from './index';
import { odApplications, certificateRequirements, students } from './schema';
import { logger } from '../utils/logger';

const seedAnalyticsSampleData = async () => {
  try {
    logger.info('Starting Analytics Sample Data Seeding...');

    // Fetch existing students from the database
    const studentRecords = await db.select({ userId: students.userId, section: students.section, admissionYear: students.admissionYear }).from(students);

    if (studentRecords.length === 0) {
      logger.error('No students found in the database. Run bun src/db/seed.ts first.');
      process.exit(1);
    }

    logger.info(`Found ${studentRecords.length} students. Generating realistic sample applications...`);

    const categories = ['Co-curricular', 'Extracurricular', 'Others'] as const;
    const cocurricularTypes = ['Hackathon', 'Seminar', 'Workshop', 'Symposium', 'Conference'];
    const extracurricularTypes = ['Sports', 'NCC', 'NSS', 'Dance'];
    const statuses = [
      'Approved',
      'Approved',
      'Approved',
      'Rejected',
      'In Progress: Mentor',
      'In Progress: Event Coordinator',
      'Withdrawn',
    ] as const;

    const sampleEvents = [
      { title: 'National Level Hackathon 2026', location: 'IIT Madras', org: 'IIT Madras' },
      { title: 'State Level Athletics Meet', location: 'Nehru Stadium, Coimbatore', org: 'SDAT' },
      { title: 'AI & Data Science Workshop', location: 'PSG Tech, Coimbatore', org: 'PSG College' },
      { title: 'Inter-College Cultural Fest', location: 'Anna University, Chennai', org: 'Anna Univ' },
      { title: 'NSS Social Awareness Camp', location: 'Pollachi Rural', org: 'MCET NSS Unit' },
      { title: 'NCC Annual Training Camp', location: 'Madukkarai Military Base', org: '5 TN Bn NCC' },
      { title: 'International Conference on ML', location: 'NIT Trichy', org: 'NIT Trichy' },
      { title: 'National Codeathon 2026', location: 'BITS Pilani, Hyderabad', org: 'BITS Hyderabad' },
      { title: 'National Youth Sports Championship', location: 'Bangalore Stadium', org: 'Sports India' },
      { title: 'Web3 & Blockchain Seminar', location: 'Coimbatore IT Park', org: 'TIE Coimbatore' },
    ];

    const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];

    let count = 0;

    for (let i = 0; i < 45; i++) {
      const student = studentRecords[i % studentRecords.length];
      const event = sampleEvents[i % sampleEvents.length];
      const category = categories[i % categories.length];
      const type =
        category === 'Co-curricular'
          ? cocurricularTypes[i % cocurricularTypes.length]
          : category === 'Extracurricular'
          ? extracurricularTypes[i % extracurricularTypes.length]
          : 'Other Event';

      const status = statuses[i % statuses.length];
      const monthStr = months[i % months.length];
      const day = String((i % 20) + 1).padStart(2, '0');
      const fromDate = `${monthStr}-${day}`;
      const toDate = `${monthStr}-${String((i % 20) + 2).padStart(2, '0')}`;
      const createdAt = new Date(`${fromDate}T09:00:00Z`);

      // Insert OD Application
      const [app] = await db
        .insert(odApplications)
        .values({
          studentId: student.userId,
          title: `${event.title} - Batch ${i + 1}`,
          fromDate,
          toDate,
          numberOfEvents: 1,
          institutionName: event.location,
          status,
          activityCategory: category,
          activityType: type,
          createdAt,
        })
        .returning();

      count++;

      // Insert Certificate Requirement if Approved
      if (status === 'Approved') {
        const certStatuses = ['Verified', 'Uploaded', 'Pending Upload', 'Deadline Expired'] as const;
        const certStatus = certStatuses[i % certStatuses.length];

        await db.insert(certificateRequirements).values({
          applicationId: app.applicationId,
          sequenceNumber: 1,
          status: certStatus,
          submissionDeadline: `${monthStr}-28`,
          createdAt,
        });
      }
    }

    logger.info(`Successfully seeded ${count} sample OD applications and certificate requirements!`);
  } catch (error) {
    logger.error({ error }, 'Failed to seed sample analytics data.');
  } finally {
    await pool.end();
  }
};

seedAnalyticsSampleData();
