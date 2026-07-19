import { Router } from 'express';
import * as dashboardsController from './dashboards.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/student', requireRole(['Student']), dashboardsController.getStudentDashboard);

export const dashboardsRoutes = router;
