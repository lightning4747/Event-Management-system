import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as certificatesController from './certificates.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted for certificate submission.'));
    }
  },
});

const handleMulterUpload = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'Certificate file size must not exceed 1 MB.',
          },
        });
      }
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: err.message || 'File upload failed.',
        },
      });
    }
    return next();
  });
};

const router = Router();

router.post('/', authenticate, requireRole(['Student']), handleMulterUpload, certificatesController.handleUpload);
router.post('/:id/verify', authenticate, requireRole(['Mentor', 'Event Coordinator']), certificatesController.handleVerification);

export const certificatesRoutes = router;
