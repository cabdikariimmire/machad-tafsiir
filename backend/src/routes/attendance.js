import { Router } from 'express';
import { 
  getAttendanceSheet, 
  saveAttendance, 
  getAttendanceReport,
  searchAttendanceStudents,
  getStudentAttendanceHistory,
  updateSingleStudentAttendance
} from '../controllers/attendanceController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';


const router = Router();

router.use(requireAuth);

router.get('/sheet', getAttendanceSheet);
router.post('/save', requireRole(['super_admin', 'institute_admin', 'quran_admin', 'attendance_officer', 'teacher']), saveAttendance);
router.get('/report', getAttendanceReport);
router.get('/search-students', searchAttendanceStudents);
router.get('/student-history', getStudentAttendanceHistory);
router.post('/update-single', requireRole(['super_admin', 'institute_admin', 'quran_admin', 'attendance_officer', 'teacher']), updateSingleStudentAttendance);

export default router;

