import { Router } from 'express';
import * as reportsController from './reports.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/global', requireRole(['Event Coordinator']), reportsController.downloadGlobalReport);
router.get('/cohort', requireRole(['Event Coordinator']), reportsController.downloadCohortReport);

export const reportsRoutes = router;
