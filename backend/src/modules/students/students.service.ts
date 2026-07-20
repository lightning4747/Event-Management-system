import { db } from '../../db';
import { students, users, odApplications, certificateRequirements, certificates } from '../../db/schema';
import { eq, desc, isNull, and } from 'drizzle-orm';
import { AppError } from '../../lib/errors';

const getAdmissionYearFromStudentYear = (studentYear: number): number => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0 is Jan, 5 is June
  
  // Academic year starts in June
  const academicBaseYear = currentMonth >= 5 ? currentYear : currentYear - 1;
  return academicBaseYear - (studentYear - 1);
};

export const getAllStudents = async (year?: number, section?: string, mentorId?: string) => {
  const conditions = [isNull(users.deletedAt)];

  if (year !== undefined) {
    const admissionYear = getAdmissionYearFromStudentYear(year);
    conditions.push(eq(students.admissionYear, admissionYear));
  }

  if (section !== undefined) {
    conditions.push(eq(students.section, section));
  }

  if (mentorId !== undefined) {
    conditions.push(eq(students.mentorId, mentorId));
  }

  return db
    .select({
      userId: students.userId,
      fullName: students.fullName,
      admissionYear: students.admissionYear,
      section: students.section,
    })
    .from(students)
    .innerJoin(users, eq(students.userId, users.userId))
    .where(and(...conditions))
    .orderBy(students.userId);
};

export const getStudentCompleteRecord = async (studentId: string, role?: string, requesterUserId?: string) => {
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
    .innerJoin(users, eq(students.userId, users.userId))
    .where(
      and(
        eq(students.userId, studentId),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (!student) {
    throw new AppError(404, 'NOT_FOUND', 'Student record not found.');
  }

  if (role === 'Mentor' && requesterUserId && student.mentorId !== requesterUserId) {
    throw new AppError(403, 'FORBIDDEN', 'Access Denied: You can only view details of your cohort mentees.');
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
