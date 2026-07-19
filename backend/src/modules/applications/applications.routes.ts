import { Router } from 'express';
import * as applicationsController from './applications.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();

router.post('/', authenticate, requireRole(['Student']), applicationsController.submitApplication);

export const applicationsRoutes = router;
