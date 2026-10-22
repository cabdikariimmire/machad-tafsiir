import { Router } from 'express';
import {
  getCourses, createCourse,
  getSubjects, createSubject, updateSubject, toggleSubjectStatus, deleteSubject,
  getClasses, createClass, updateClass, toggleClassStatus, deleteClass, getClassStudents,
  getClassSubjects, assignClassSubjects, removeClassSubject,
  getTimetable, createTimetableEntry, updateTimetableEntry, deleteTimetableEntry,
  getTeacherAssignments, createTeacherAssignment, deleteTeacherAssignment, getInstituteTeachers
} from '../controllers/instituteController.js';
import { requireAuth, requireDivisionScope, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.use(requireDivisionScope('institute'));

// ==========================================
// 1. CLASSES & CLASS SUBJECTS
// ==========================================
router.get('/classes', getClasses);
router.post('/classes', requireRole(['super_admin', 'institute_admin']), createClass);
router.put('/classes/:id', requireRole(['super_admin', 'institute_admin']), updateClass);
router.patch('/classes/:id/toggle-status', requireRole(['super_admin', 'institute_admin']), toggleClassStatus);
router.delete('/classes/:id', requireRole(['super_admin', 'institute_admin']), deleteClass);
router.get('/classes/:id/students', getClassStudents);

// Manage Class Subjects (Junction)
router.get('/classes/:id/subjects', getClassSubjects);
router.post('/classes/:id/subjects', requireRole(['super_admin', 'institute_admin']), assignClassSubjects);
router.delete('/classes/:id/subjects/:subject_id', requireRole(['super_admin', 'institute_admin']), removeClassSubject);

// ==========================================
// 2. SUBJECTS (Centrally Registered)
// ==========================================
router.get('/subjects', getSubjects);
router.post('/subjects', requireRole(['super_admin', 'institute_admin']), createSubject);
router.put('/subjects/:id', requireRole(['super_admin', 'institute_admin']), updateSubject);
router.patch('/subjects/:id/toggle-status', requireRole(['super_admin', 'institute_admin']), toggleSubjectStatus);
router.delete('/subjects/:id', requireRole(['super_admin', 'institute_admin']), deleteSubject);

// ==========================================
// 3. TIMETABLE (Weekly Schedule, Overlap Detection)
// ==========================================
router.get('/timetable', getTimetable);
router.post('/timetable', requireRole(['super_admin', 'institute_admin']), createTimetableEntry);
router.put('/timetable/:id', requireRole(['super_admin', 'institute_admin']), updateTimetableEntry);
router.delete('/timetable/:id', requireRole(['super_admin', 'institute_admin']), deleteTimetableEntry);

// ==========================================
// 4. COURSES & LEGACY
// ==========================================
router.get('/courses', getCourses);
router.post('/courses', requireRole(['super_admin', 'institute_admin']), createCourse);
router.get('/teacher-assignments', getTeacherAssignments);
router.post('/teacher-assignments', requireRole(['super_admin', 'institute_admin']), createTeacherAssignment);
router.delete('/teacher-assignments/:id', requireRole(['super_admin', 'institute_admin']), deleteTeacherAssignment);
router.get('/teachers', requireRole(['super_admin', 'institute_admin']), getInstituteTeachers);

export default router;
