import { Router } from 'express';
import { listUsers, listRoles, createUser, updateUser, resetPassword, toggleUserStatus, deleteUser } from '../controllers/userController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Only Super Admin, Institute Admin, and Quran Admin can access user management
router.use(requireAuth);
router.use(requireRole(['super_admin', 'institute_admin', 'quran_admin']));

router.get('/', listUsers);
router.get('/roles', listRoles);
router.post('/', createUser);
router.put('/:id', updateUser);
router.post('/:id/reset-password', resetPassword);
router.patch('/:id/reset-password', resetPassword);
router.patch('/:id/toggle-status', toggleUserStatus);
router.delete('/:id', deleteUser);

export default router;

