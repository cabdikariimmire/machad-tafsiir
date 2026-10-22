import { Router } from 'express';
import { 
  getFinancialReports, 
  getOutstandingFeesReport,
  getStudentFinancialProfile,
  getAttendanceReport,
  getExamResultsReport,
  getStudentsReport,
  getQuranHifdhReport
} from '../controllers/reportController.js';
import { getHistoricalExamReports } from '../controllers/examController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/finance', requireRole(['super_admin', 'institute_admin', 'quran_admin', 'finance_user']), getFinancialReports);
router.get('/outstanding-fees', requireRole(['super_admin', 'institute_admin', 'quran_admin', 'finance_user']), getOutstandingFeesReport);
router.get('/student-financial/:student_id', requireRole(['super_admin', 'institute_admin', 'quran_admin', 'finance_user']), getStudentFinancialProfile);
router.get('/attendance', getAttendanceReport);
router.get('/exams', getExamResultsReport);
router.get('/historical-exams', requireRole(['super_admin', 'institute_admin', 'examination_officer']), getHistoricalExamReports);
router.get('/students', getStudentsReport);
router.get('/quran-hifdh', getQuranHifdhReport);

export default router;

