import { PDFDocument, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { db } from '../../db';
import { students, users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { getApplicationDetails } from './applications.service';
import { AppError } from '../../lib/errors';

export const generateApplicationPdf = async (
  applicationId: bigint,
  studentId: string
): Promise<Buffer> => {
  // 1. Fetch full application details
  const details = await getApplicationDetails(applicationId, studentId, 'Student');

  // 2. Strict Security: Student ownership check
  if (details.application.studentId !== studentId) {
    throw new AppError(403, 'FORBIDDEN', 'Access Denied: You can only export your own applications.');
  }

  // 3. Strict Security: Enforce application status === 'Approved'
  if (details.application.status !== 'Approved') {
    throw new AppError(400, 'APPLICATION_NOT_APPROVED', 'PDF export is only available for fully approved applications.');
  }

  // 4. Fetch student profile details (admissionYear, section)
  const [studentRecord] = await db
    .select({
      admissionYear: students.admissionYear,
      section: students.section,
    })
    .from(students)
    .innerJoin(users, eq(students.userId, users.userId))
    .where(eq(students.userId, studentId))
    .limit(1);

  // Calculate year from admission year
  const currentYear = new Date().getFullYear();
  const yearDiff = studentRecord ? Math.max(1, Math.min(4, currentYear - studentRecord.admissionYear + 1)) : 3;
  const romanYears = ['I', 'II', 'III', 'IV'];
  const yearStr = `${romanYears[yearDiff - 1] || 'III'} Year`;
  const sectionStr = studentRecord?.section || 'A';

  // 5. Load PDF Template from project directory
  const templatePath = path.resolve(process.cwd(), 'src/assets/templates/export_template.pdf');
  const fallbackPath = path.resolve(process.cwd(), 'backend/src/assets/templates/export_template.pdf');

  let templateBytes: Buffer;
  /* eslint-disable security/detect-non-literal-fs-filename */
  if (fs.existsSync(templatePath)) {
    templateBytes = fs.readFileSync(templatePath);
  } else if (fs.existsSync(fallbackPath)) {
    templateBytes = fs.readFileSync(fallbackPath);
  } else {
    throw new AppError(500, 'INTERNAL_SERVER_ERROR', 'PDF export template file not found on server.');
  }
  /* eslint-enable security/detect-non-literal-fs-filename */

  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const page = pdfDoc.getPages()[0];

  const formatDate = (dateStr?: string | Date | null) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const app = details.application;

  const eventDateStr = `${formatDate(app.fromDate)} to ${formatDate(app.toDate)} (${app.numberOfEvents} ${app.numberOfEvents === 1 ? 'day' : 'days'})`;

  const activityStr = app.events && app.events.length > 0
    ? app.events.map(e => e.activityType).join(', ')
    : (app.activityType || 'General OD Participation');

  const getApprovalDate = (role: string) => {
    const log = details.history.find(h => h.approverRole === role && h.decision === 'Approve');
    return log ? `Approved (${formatDate(log.decidedAt)})` : 'Approved';
  };

  const ecApproval = getApprovalDate('Event Coordinator');
  const mentorApproval = getApprovalDate('Mentor');
  const pcApproval = getApprovalDate('Program Coordinator');
  const hodApproval = getApprovalDate('Head of Department');

  // ── Coordinates extracted directly from export_template.pdf (1190 x 1684) ──
  // y values are each label's colon baseline (page.height - pdfplumber `bottom`).
  // BASELINE_FIX nudges text up onto the true glyph baseline — bigger font size
  // needs a bigger fix since more of the glyph sits below the reference point.
  // VALUE_X is a single shared left edge so all values sit on one vertical grid
  // regardless of label length.
  const BASELINE_FIX = 8;
  const VALUE_X = 400;
  const DEFAULT_VALUE_SIZE = 24; // bumped up from 18 — same font, larger size

  type Field = { text: string; y: number; x?: number; size?: number };

  const drawValue = (f: Field, defaultSize = DEFAULT_VALUE_SIZE) => {
    page.drawText(f.text, {
      x: f.x ?? VALUE_X,
      y: f.y + BASELINE_FIX,
      size: f.size ?? defaultSize,
      font,
    });
  };

  const studentFields: Field[] = [
    { text: app.studentName || 'N/A', y: 1169.7 },
    { text: app.studentId || 'N/A', y: 1091.7 },
    { text: 'Artificial Intelligence and Data Science', y: 1013.7, size: 20 }, // long text, kept slightly smaller to avoid overflow
    { text: yearStr, y: 935.8 },
    { text: sectionStr, y: 857.8 },
  ];

  const eventFields: Field[] = [
    { text: app.title || 'N/A', y: 690.9 },
    { text: app.institutionName || 'N/A', y: 612.9 },
    { text: app.institutionName || 'College Campus', y: 535.0 },
    { text: eventDateStr, y: 457.0, size: 20 }, // long text, kept slightly smaller to avoid overflow
    { text: '08:30 AM', y: 379.0 },
    { text: '05:30 PM', y: 301.0 },
    { text: activityStr, y: 223.0, size: 20 }, // long text, kept slightly smaller to avoid overflow
  ];

  studentFields.forEach(f => drawValue(f));
  eventFields.forEach(f => drawValue(f));

  // Approvals — centered under each full label span, one line below the
  // label (label baseline is y=79.2) so text never overlaps the name.
  const APPROVAL_SIZE = 14;
  const APPROVAL_GAP_BELOW = 35; // vertical gap from label baseline to approval line
  const APPROVAL_Y = 79.2 - APPROVAL_GAP_BELOW;

  const approvalCenters: { text: string; labelCenter: number }[] = [
    { text: ecApproval, labelCenter: 227.2 },   // "Event Coordinator" span midpoint
    { text: mentorApproval, labelCenter: 504.3 }, // "Mentor" span midpoint
    { text: pcApproval, labelCenter: 803.5 },   // "Program Coordinator" span midpoint
    { text: hodApproval, labelCenter: 1071.2 }, // "HoD" span midpoint
  ];

  approvalCenters.forEach(({ text, labelCenter }) => {
    const textWidth = font.widthOfTextAtSize(text, APPROVAL_SIZE);
    page.drawText(text, {
      x: labelCenter - textWidth / 2,
      y: APPROVAL_Y,
      size: APPROVAL_SIZE,
      font,
    });
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
};