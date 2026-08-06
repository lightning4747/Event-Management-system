import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as applicationsController from './applications.controller';
import { handleDecision } from '../decisions/decisions.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(pdf|png|jpg|jpeg)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, and PNG files are accepted as event proof.'));
    }
  },
});

const handleMulterProof = (req: Request, res: Response, next: NextFunction) => {
  proofUpload.single('proofFile')(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'Event proof file size must not exceed 5 MB.',
          },
        });
      }
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: (err as Error)?.message || 'Proof file upload failed.',
        },
      });
    }
    return next();
  });
};

const router = Router();

router.post('/', authenticate, requireRole(['Student']), handleMulterProof, applicationsController.submitApplication);
router.get('/my', authenticate, requireRole(['Student']), applicationsController.getStudentHistory);
router.get('/', authenticate, requireRole(['Mentor', 'Event Coordinator', 'Program Coordinator', 'Head of Department']), applicationsController.listDepartmentApplications);
router.get('/:id', authenticate, requireRole(['Student', 'Mentor', 'Event Coordinator', 'Program Coordinator', 'Head of Department']), applicationsController.viewApplicationDetails);
router.get('/:id/export-pdf', authenticate, requireRole(['Student']), applicationsController.exportApplicationPdf);
router.post('/:id/decide', authenticate, requireRole(['Event Coordinator', 'Mentor', 'Program Coordinator', 'Head of Department']), handleDecision);
router.post('/:id/withdraw', authenticate, requireRole(['Student']), applicationsController.withdrawApplication);

export const applicationsRoutes = router;
