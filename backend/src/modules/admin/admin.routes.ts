import { Router } from 'express';
import * as adminController from './admin.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();

router.use(authenticate, requireRole(['Administrator']));

router.post('/faculty', adminController.onboardFaculty);
router.get('/faculty', adminController.listFaculty);
router.patch('/assign-role', adminController.assignRole);

export const adminRoutes = router;
