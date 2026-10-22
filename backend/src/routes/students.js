import { Router } from 'express';
import { listStudents, getStudentById, createStudent, updateStudent, deleteStudent, archiveStudent } from '../controllers/studentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', listStudents);
router.get('/:id', getStudentById);
router.post('/', requireRole(['super_admin', 'institute_admin', 'quran_admin']), createStudent);
router.put('/:id', requireRole(['super_admin', 'institute_admin', 'quran_admin']), updateStudent);
router.patch('/:id/archive', requireRole(['super_admin', 'institute_admin', 'quran_admin']), archiveStudent);
router.delete('/:id', requireRole(['super_admin', 'institute_admin', 'quran_admin']), deleteStudent);

export default router;

