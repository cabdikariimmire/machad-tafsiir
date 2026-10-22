import { Router } from 'express';
import {
  listExams,
  createExam,
  updateExam,
  deleteExam,
  getExamMarksSheet,
  saveExamMarks,
  getClassResultsSheet,
  exportClassResultsExcel,
  getStudentResultSheet,
  exportStudentResultExcel,
  listExamPeriods,
  listExamSets,
  saveExamSet,
  createExamPeriod,
  updateExamPeriod,
  deleteExamPeriod,
  deleteAllExamPeriods,
  getUnifiedClassMarksSheet,
  saveUnifiedClassMarks,
  getAssessmentConfig,
  saveAssessmentConfig,
  setupStandardExamScheme,
  saveSchemeRule,
  getClassExamTimetable,
  saveClassExamTimetable,
  deleteClassExamTimetableEntry,
  saveSingleMark,
  getClassProgression,
  updateClassProgression,
  confirmFinalResults,
  getPromotionPreview,
  executePromotions,
  overrideStudentPromotion,
  getPromotionHistory,
  getHistoricalExamReports,
  getExamFeeRules,
  setExamFeeRule,
  getStudentExamFeeStatus,
  recordExamFeePayment,
  getExamFeeHistory,
  getExamFeeReceipt
} from '../controllers/examController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
// Strictly restrict examination management to Examination Office and Admins (Teachers strictly blocked)
router.use(requireRole(['super_admin', 'institute_admin', 'quran_admin', 'examination_officer']));

// 1. Examination Results & Reporting
router.get('/results/class', getClassResultsSheet);
router.get('/results/class/export', exportClassResultsExcel);
router.get('/results/student/:student_id', getStudentResultSheet);
router.get('/results/student/:student_id/export', exportStudentResultExcel);

// 2. Academic-Year Assessment Config & Marking Scheme
router.get('/assessment-config', getAssessmentConfig);
router.post('/assessment-config', requireRole(['super_admin', 'institute_admin', 'examination_officer']), saveAssessmentConfig);
router.post('/setup-standard-scheme', requireRole(['super_admin', 'institute_admin', 'examination_officer']), setupStandardExamScheme);
router.post('/scheme-rule', requireRole(['super_admin', 'institute_admin', 'examination_officer']), saveSchemeRule);

// 3. Examination Periods / Plan Configuration
router.get('/periods', listExamPeriods);
router.get('/exam-sets', listExamSets);
router.post('/exam-sets', requireRole(['super_admin', 'institute_admin', 'examination_officer']), saveExamSet);
router.post('/periods', requireRole(['super_admin', 'institute_admin', 'quran_admin', 'examination_officer']), createExamPeriod);
router.put('/periods/:id', requireRole(['super_admin', 'institute_admin', 'quran_admin', 'examination_officer']), updateExamPeriod);
router.post('/periods/delete-all', requireRole(['super_admin', 'institute_admin', 'examination_officer']), deleteAllExamPeriods);
router.delete('/periods/all', requireRole(['super_admin', 'institute_admin', 'examination_officer']), deleteAllExamPeriods);
router.delete('/periods/:id', requireRole(['super_admin', 'institute_admin', 'quran_admin', 'examination_officer']), deleteExamPeriod);

// 4. Examination Timetables
router.get('/timetables', getClassExamTimetable);
router.post('/timetables', requireRole(['super_admin', 'institute_admin', 'examination_officer']), saveClassExamTimetable);
router.delete('/timetables/:id', requireRole(['super_admin', 'institute_admin', 'examination_officer']), deleteClassExamTimetableEntry);

// 5. Automatic Single-Mark & Class-Wide Marks Entry
router.post('/single-mark', requireRole(['super_admin', 'institute_admin', 'examination_officer']), saveSingleMark);
router.get('/unified-sheet', getUnifiedClassMarksSheet);
router.post('/unified-marks', requireRole(['super_admin', 'institute_admin', 'quran_admin', 'examination_officer']), saveUnifiedClassMarks);

// 6. Class Progression, Promotions & Graduation
router.get('/classes/progression', getClassProgression);
router.put('/classes/progression', requireRole(['super_admin', 'institute_admin']), updateClassProgression);
router.post('/promotions/confirm-results', requireRole(['super_admin', 'institute_admin', 'examination_officer']), confirmFinalResults);
router.get('/promotions/preview', getPromotionPreview);
router.post('/promotions/execute', requireRole(['super_admin', 'institute_admin', 'examination_officer']), executePromotions);
router.post('/promotions/override', requireRole(['super_admin', 'institute_admin']), overrideStudentPromotion);
router.get('/promotions/history', getPromotionHistory);

// 7. Comprehensive Searchable Historical Reports
router.get('/reports/historical', getHistoricalExamReports);

// 8. Exam Fee Management (رسوم الامتحان)
router.get('/fees/rules', getExamFeeRules);
router.post('/fees/rules', requireRole(['super_admin', 'institute_admin', 'finance_officer', 'examination_officer']), setExamFeeRule);
router.get('/fees/student-status', getStudentExamFeeStatus);
router.get('/fee/status', getStudentExamFeeStatus);
router.post('/fees/pay', requireRole(['super_admin', 'institute_admin', 'finance_officer', 'examination_officer']), recordExamFeePayment);
router.post('/fee/payment', requireRole(['super_admin', 'institute_admin', 'finance_officer', 'examination_officer']), recordExamFeePayment);
router.get('/fees/history', getExamFeeHistory);
router.get('/fee/history', getExamFeeHistory);
router.get('/fees/receipt/:id', getExamFeeReceipt);
router.get('/fee/receipt/:id', getExamFeeReceipt);

// 9. Traditional Exam CRUD & Marks Entry (by individual exam :id)
router.get('/', listExams);
router.post('/', requireRole(['super_admin', 'institute_admin', 'quran_admin', 'examination_officer']), createExam);
router.put('/:id', requireRole(['super_admin', 'institute_admin', 'quran_admin', 'examination_officer']), updateExam);
router.delete('/:id', requireRole(['super_admin', 'institute_admin', 'quran_admin', 'examination_officer']), deleteExam);

router.get('/:id/sheet', getExamMarksSheet);
router.post('/:id/marks', requireRole(['super_admin', 'institute_admin', 'quran_admin', 'examination_officer']), saveExamMarks);

export default router;
