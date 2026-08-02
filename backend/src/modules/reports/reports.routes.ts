import { Router } from 'express';
import * as reportsController from './reports.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

// Global Department On-Duty CSV Report (Department-wide)
router.get(
  '/global',
  requireRole(['Event Coordinator', 'Program Coordinator', 'Head of Department']),
  reportsController.downloadGlobalReport
);

// Cohort-specific On-Duty CSV Report (Mentors for their assigned mentees)
router.get(
  '/cohort',
  requireRole(['Mentor']),
  reportsController.downloadCohortReport
);

// Global Department On-Duty Excel Report — multi-sheet, per-sub-event rows (Department-wide)
router.get(
  '/global-excel',
  requireRole(['Event Coordinator', 'Program Coordinator', 'Head of Department']),
  reportsController.downloadGlobalExcel
);

// Cohort-specific On-Duty Excel Report — multi-sheet, per-sub-event rows (Mentor cohort)
router.get(
  '/cohort-excel',
  requireRole(['Mentor']),
  reportsController.downloadCohortExcel
);

export const reportsRoutes = router;
