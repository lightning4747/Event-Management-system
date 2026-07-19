import { Router } from 'express';
import * as reportsController from './reports.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/global', requireRole(['Event Coordinator', 'Program Coordinator', 'Head of Department']), reportsController.downloadGlobalReport);
router.get('/cohort', requireRole(['Mentor']), reportsController.downloadCohortReport);

export const reportsRoutes = router;
