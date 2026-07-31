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

export const reportsRoutes = router;
