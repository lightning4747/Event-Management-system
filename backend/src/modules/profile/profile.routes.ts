import { Router } from 'express';
import * as profileController from './profile.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', profileController.viewProfile);
router.patch('/', requireRole(['Mentor', 'Event Coordinator', 'Program Coordinator', 'Head of Department', 'Administrator']), profileController.editProfile);

export const profileRoutes = router;
