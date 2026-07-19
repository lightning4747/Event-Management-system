import { Router } from 'express';
import * as mentorController from './mentor.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();

router.use(authenticate, requireRole(['Mentor']));

router.post('/students', mentorController.onboardStudent);
router.get('/mentees', mentorController.listMentees);

export const mentorRoutes = router;
