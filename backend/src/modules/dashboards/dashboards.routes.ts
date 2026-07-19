import { Router } from 'express';
import * as dashboardsController from './dashboards.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/student', requireRole(['Student']), dashboardsController.getStudentDashboard);
router.get('/coordinator', requireRole(['Event Coordinator']), dashboardsController.getCoordinatorDashboard);
router.get('/mentor', requireRole(['Mentor']), dashboardsController.getMentorDashboard);
router.get('/hod', requireRole(['Head of Department']), dashboardsController.getHODDashboard);

export const dashboardsRoutes = router;
