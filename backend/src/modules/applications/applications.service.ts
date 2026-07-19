import { db } from '../../db';
import { odApplications, students } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { AppError } from '../../lib/errors';
import { CreateApplicationInput } from './applications.types';

export const createApplication = async (
  input: CreateApplicationInput,
  studentId: string
): Promise<{ applicationId: bigint; studentId: string; title: string; status: string; createdAt: Date }> => {
  // Verify student exists in students table
  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.userId, studentId))
    .limit(1);

  if (!student) {
    throw new AppError(404, 'NOT_FOUND', 'Student record not found in system.');
  }

  const [insertedApp] = await db
    .insert(odApplications)
    .values({
      studentId,
      title: input.title,
      location: input.location,
      fromDate: input.fromDate,
      toDate: input.toDate,
      numberOfEvents: input.numberOfEvents,
      status: 'In Progress: Event Coordinator',
    })
    .returning({
      applicationId: odApplications.applicationId,
      studentId: odApplications.studentId,
      title: odApplications.title,
      status: odApplications.status,
      createdAt: odApplications.createdAt,
    });

  return insertedApp;
};

export const getStudentApplications = async (
  studentId: string
): Promise<Array<{
  applicationId: bigint;
  studentId: string;
  title: string;
  location: string;
  fromDate: string;
  toDate: string;
  numberOfEvents: number;
  status: 'In Progress: Event Coordinator' | 'In Progress: Mentor' | 'In Progress: Program Coordinator' | 'In Progress: Head of Department' | 'Approved' | 'Rejected' | 'Withdrawn';
  finalApprovedAt: Date | null;
  withdrawnAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>> => {
  return db
    .select()
    .from(odApplications)
    .where(eq(odApplications.studentId, studentId))
    .orderBy(desc(odApplications.createdAt));
};
