import { Router } from 'express';
import * as applicationsController from './applications.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();

router.post('/', authenticate, requireRole(['Student']), applicationsController.submitApplication);
router.get('/my', authenticate, requireRole(['Student']), applicationsController.getStudentHistory);
router.get('/', authenticate, requireRole(['Event Coordinator', 'Program Coordinator', 'Head of Department']), applicationsController.listDepartmentApplications);
router.get('/:id', authenticate, requireRole(['Student', 'Mentor', 'Event Coordinator', 'Program Coordinator', 'Head of Department']), applicationsController.viewApplicationDetails);

export const applicationsRoutes = router;
