import { db } from '../../db';
import { students, users, odApplications, certificateRequirements, certificates } from '../../db/schema';
import { eq, desc, isNull } from 'drizzle-orm';
import { AppError } from '../../lib/errors';

export const getAllStudents = async () => {
  return db
    .select({
      userId: students.userId,
      fullName: students.fullName,
      admissionYear: students.admissionYear,
      section: students.section,
    })
    .from(students)
    .innerJoin(users, eq(students.userId, users.userId))
    .where(isNull(users.deletedAt))
    .orderBy(students.userId);
};

export const getStudentCompleteRecord = async (studentId: string) => {
  const [student] = await db
    .select({
      userId: students.userId,
      fullName: students.fullName,
      dateOfBirth: students.dateOfBirth,
      admissionYear: students.admissionYear,
      section: students.section,
      mentorId: students.mentorId,
    })
    .from(students)
    .where(eq(students.userId, studentId))
    .limit(1);

  if (!student) {
    throw new AppError(404, 'NOT_FOUND', 'Student record not found.');
  }

  const applications = await db
    .select()
    .from(odApplications)
    .where(eq(odApplications.studentId, studentId))
    .orderBy(desc(odApplications.createdAt));

  const certs = await db
    .select({
      requirementId: certificateRequirements.requirementId,
      applicationId: certificateRequirements.applicationId,
      sequenceNumber: certificateRequirements.sequenceNumber,
      status: certificateRequirements.status,
      submissionDeadline: certificateRequirements.submissionDeadline,
      rejectionReason: certificateRequirements.rejectionReason,
      fileUrl: certificates.fileUrl,
      uploadedAt: certificates.uploadedAt,
    })
    .from(certificateRequirements)
    .innerJoin(odApplications, eq(certificateRequirements.applicationId, odApplications.applicationId))
    .leftJoin(certificates, eq(certificateRequirements.requirementId, certificates.requirementId))
    .where(eq(odApplications.studentId, studentId))
    .orderBy(desc(certificates.uploadedAt));

  return {
    student,
    applications: applications.map(a => ({
      ...a,
      applicationId: a.applicationId.toString(),
    })),
    certificates: certs.map(c => ({
      ...c,
      requirementId: c.requirementId.toString(),
      applicationId: c.applicationId.toString(),
    })),
  };
};
