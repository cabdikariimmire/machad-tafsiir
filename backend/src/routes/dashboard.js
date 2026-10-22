import { Router } from 'express';
import {
  getGeneralDashboardStats,
  getDashboardAnalytics,
  getNotifications,
  markNotificationRead,
  getAuditLogs
} from '../controllers/dashboardController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/stats', getGeneralDashboardStats);
router.get('/analytics', getDashboardAnalytics);
router.get('/notifications', getNotifications);
router.patch('/notifications/:id/read', markNotificationRead);
router.get('/audit-logs', requireRole(['super_admin', 'institute_admin', 'quran_admin']), getAuditLogs);

export default router;
