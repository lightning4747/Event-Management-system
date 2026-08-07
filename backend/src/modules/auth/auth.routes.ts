import { Router } from 'express';
import * as authController from './auth.controller';
import { loginLimiter } from '../../middleware/rateLimiter';

const router = Router();

router.post('/login', loginLimiter, authController.login);
router.post('/logout', authController.logout);

export const authRoutes = router;
