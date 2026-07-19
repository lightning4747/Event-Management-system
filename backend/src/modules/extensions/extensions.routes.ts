import { Router } from 'express';
import * as extensionsController from './extensions.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();

router.post('/', authenticate, requireRole(['Mentor']), extensionsController.handleCreateExtension);

export const extensionsRoutes = router;
