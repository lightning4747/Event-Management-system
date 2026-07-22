import { Router } from 'express';
import * as extensionsController from './extensions.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();

router.post('/request', authenticate, requireRole(['Student']), extensionsController.handleRequestExtension);
router.get('/pending', authenticate, requireRole(['Mentor']), extensionsController.handleGetPendingExtensions);
router.post('/:id/decide', authenticate, requireRole(['Mentor']), extensionsController.handleDecideExtension);

export const extensionsRoutes = router;
