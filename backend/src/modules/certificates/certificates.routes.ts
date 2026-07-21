import { Router } from 'express';
import multer from 'multer';
import * as certificatesController from './certificates.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted for certificate submission.'));
    }
  },
});

const router = Router();

router.post('/', authenticate, requireRole(['Student']), upload.single('file'), certificatesController.handleUpload);
router.post('/:id/verify', authenticate, requireRole(['Event Coordinator']), certificatesController.handleVerification);

export const certificatesRoutes = router;
