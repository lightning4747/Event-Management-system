import { Router } from 'express';
import * as certificatesController from './certificates.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();

router.post('/', authenticate, requireRole(['Student']), certificatesController.handleUpload);
router.post('/:id/verify', authenticate, requireRole(['Event Coordinator']), certificatesController.handleVerification);

export const certificatesRoutes = router;
