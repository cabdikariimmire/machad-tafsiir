import { Router } from 'express';
import {
  getLevels, createLevel,
  getGroups, createGroup, updateGroup, deleteGroup, getGroupStudents,
  registerStudentToGroup, enrollExistingStudentToGroup, removeStudentFromGroup, getAvailableStudents,
  getTransferStudents, getQuranTransferHistory, transferQuranStudent,
  getQuranTeacherAssignments, createQuranTeacherAssignment, removeQuranTeacherAssignment,
  getSurahs, getJuzList,
  getSurahVerses, saveSurahVerses,
  getStudentSurahs, saveStudentSurahs,
  getStudentMemorizationSummary,
  getStudentExaminations, createStudentExamination, updateStudentExamination,
  getHifdhProgress, recordHifdhProgress,
  getCertificates, issueCertificate
} from '../controllers/quranController.js';
import { requireAuth, requireDivisionScope, requireRole } from '../middleware/auth.js';

import {
  listQuranTeachers,
  createQuranTeacher,
  updateQuranTeacher,
  toggleQuranTeacherStatus,
  archiveQuranTeacher,
  deleteQuranTeacher
} from '../controllers/teacherController.js';

import {
  getExamErrorTypes,
  createExamErrorType,
  updateExamErrorType,
  toggleExamErrorType,
  deleteExamErrorType,
  searchStudentsForExam,
  listMemorizationExams,
  getMemorizationExamById,
  createMemorizationExam,
  updateMemorizationExam,
  deleteMemorizationExam,
  listQuranExamSessions,
  createQuranExamSession,
  deleteQuranExamSession
} from '../controllers/quranExamController.js';

const router = Router();

router.use(requireAuth);
router.use(requireDivisionScope('quran'));

// Configurable Error Types & Scoring Settings
router.get('/exam-error-types', getExamErrorTypes);
router.post('/exam-error-types', requireRole(['super_admin', 'quran_admin']), createExamErrorType);
router.put('/exam-error-types/:id', requireRole(['super_admin', 'quran_admin']), updateExamErrorType);
router.patch('/exam-error-types/:id/toggle', requireRole(['super_admin', 'quran_admin']), toggleExamErrorType);
router.delete('/exam-error-types/:id', requireRole(['super_admin', 'quran_admin']), deleteExamErrorType);

// Student Search for Quran Examinations (Arabic name & RTL support)
router.get('/students-search', searchStudentsForExam);

// Quran Exam Sessions (Master Sessions / Kalka Imtixaanka)
router.get('/exam-sessions', requireRole(['super_admin', 'quran_admin', 'examination_officer']), listQuranExamSessions);
router.post('/exam-sessions', requireRole(['super_admin', 'quran_admin', 'examination_officer']), createQuranExamSession);
router.delete('/exam-sessions/:id', requireRole(['super_admin', 'quran_admin', 'examination_officer']), deleteQuranExamSession);

// Quran Memorization Examinations Workflow & History (Examination Office & Admins only)
router.get('/memorization-exams', requireRole(['super_admin', 'quran_admin', 'examination_officer']), listMemorizationExams);
router.get('/memorization-exams/:id', requireRole(['super_admin', 'quran_admin', 'examination_officer']), getMemorizationExamById);
router.post('/memorization-exams', requireRole(['super_admin', 'quran_admin', 'examination_officer']), createMemorizationExam);
router.put('/memorization-exams/:id', requireRole(['super_admin', 'quran_admin', 'examination_officer']), updateMemorizationExam);
router.delete('/memorization-exams/:id', requireRole(['super_admin', 'quran_admin', 'examination_officer']), deleteMemorizationExam);

// Teachers Management (Quran School)
router.get('/teachers', listQuranTeachers);
router.post('/teachers', requireRole(['super_admin', 'quran_admin']), createQuranTeacher);
router.put('/teachers/:id', requireRole(['super_admin', 'quran_admin']), updateQuranTeacher);
router.patch('/teachers/:id/toggle-status', requireRole(['super_admin', 'quran_admin']), toggleQuranTeacherStatus);
router.patch('/teachers/:id/archive', requireRole(['super_admin', 'quran_admin']), archiveQuranTeacher);
router.delete('/teachers/:id', requireRole(['super_admin', 'quran_admin']), deleteQuranTeacher);

// Levels
router.get('/levels', getLevels);
router.post('/levels', requireRole(['super_admin', 'quran_admin']), createLevel);

// Groups (Quran School Classes - Fasallada)
router.get('/groups', getGroups);
router.post('/groups', requireRole(['super_admin', 'quran_admin']), createGroup);
router.put('/groups/:id', requireRole(['super_admin', 'quran_admin']), updateGroup);
router.delete('/groups/:id', requireRole(['super_admin', 'quran_admin']), deleteGroup);
router.get('/groups/:id/students', getGroupStudents);
router.post('/groups/:id/register-student', requireRole(['super_admin', 'quran_admin']), registerStudentToGroup);
router.post('/groups/:id/enroll-student', requireRole(['super_admin', 'quran_admin']), enrollExistingStudentToGroup);
router.delete('/groups/:id/students/:studentId', requireRole(['super_admin', 'quran_admin']), removeStudentFromGroup);
router.get('/available-students', requireRole(['super_admin', 'quran_admin']), getAvailableStudents);
router.get('/transfer-students', requireRole(['super_admin', 'quran_admin']), getTransferStudents);
router.get('/transfer-history', requireRole(['super_admin', 'quran_admin']), getQuranTransferHistory);
router.post('/transfer-student', requireRole(['super_admin', 'quran_admin']), transferQuranStudent);

// Teacher Assignments (Legacy/Direct)
router.get('/teacher-assignments', getQuranTeacherAssignments);
router.post('/teacher-assignments', requireRole(['super_admin', 'quran_admin']), createQuranTeacherAssignment);
router.delete('/teacher-assignments/:id', requireRole(['super_admin', 'quran_admin']), removeQuranTeacherAssignment);

// Quran Metadata
router.get('/surahs', getSurahs);
router.get('/juz', getJuzList);

// 114 Surahs Memorization (Diiwaanka Xifdiga)
router.get('/students/:id/surahs', requireRole(['super_admin', 'quran_admin', 'teacher']), getStudentSurahs);
router.post('/students/:id/surahs', requireRole(['super_admin', 'quran_admin', 'teacher']), saveStudentSurahs);

// Verse-Level Memorization
router.get('/surahs/:number/verses', getSurahVerses);
router.post('/surahs/:number/verses', requireRole(['super_admin', 'quran_admin', 'teacher']), saveSurahVerses);

// Student Summary (Surah progress, 30 Juz progress, Exams, Attendance, Fees)
router.get('/students/:id/summary', getStudentMemorizationSummary);

// Quran Examination Ranges
router.get('/examinations', requireRole(['super_admin', 'quran_admin', 'examination_officer']), getStudentExaminations);
router.post('/examinations', requireRole(['super_admin', 'quran_admin', 'examination_officer']), createStudentExamination);
router.put('/examinations/:id', requireRole(['super_admin', 'quran_admin', 'examination_officer']), updateStudentExamination);

// Quran Certificates
router.get('/certificates', getCertificates);
router.post('/certificates', requireRole(['super_admin', 'quran_admin', 'examination_officer']), issueCertificate);

// Legacy Hifdh Progress log
router.get('/progress', getHifdhProgress);
router.post('/progress', requireRole(['super_admin', 'quran_admin', 'teacher']), recordHifdhProgress);

export default router;

