import { Router } from 'express';
import * as studentsController from './students.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();
router.use(authenticate, requireRole(['Mentor', 'Event Coordinator', 'Program Coordinator', 'Head of Department', 'Administrator']));

router.get('/', studentsController.listAllStudents);
router.get('/:id/details', studentsController.getStudentDetails);

export const studentsRoutes = router;
