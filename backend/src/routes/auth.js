import { Router } from 'express';
import { login, logout, getCurrentUser, changePassword } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', getCurrentUser);
router.post('/change-password', requireAuth, changePassword);

export default router;
