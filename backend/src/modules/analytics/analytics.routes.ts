import { Router } from 'express';
import * as analyticsController from './analytics.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requireRole(['Event Coordinator', 'Program Coordinator', 'Head of Department', 'Administrator']),
  analyticsController.getAnalyticsData
);

export const analyticsRoutes = router;
