import ExcelJS from 'exceljs';
import { query, withTransaction } from '../db/connection.js';
import { logAudit } from '../services/auditService.js';
import {
  OFFICIAL_EXAM_PERIODS,
  FIRST_HALF_EXAMS,
  SECOND_HALF_EXAMS,
  ALL_OFFICIAL_EXAMS,
  getOfficialExamMax,
  isFirstHalfExam,
  isSecondHalfExam,
  ensureOfficialExamPeriods
} from '../services/examStructureService.js';

/**
 * Sanitize text to prevent Excel Formula Injection (CSV/Formula injection CWE-1236)
 */
function sanitizeForExcel(val) {
  if (typeof val === 'string' && ['=', '+', '-', '@'].includes(val.charAt(0))) {
    return `'${val}`;
  }
  return val;
}

async function getConfiguredExamSetForYear(academic_year = '2026', exam_set_id = null) {
  const params = [academic_year];
  let where = 'ies.academic_year = ?';
  if (exam_set_id) {
    where += ' AND ies.id = ?';
    params.push(exam_set_id);
  }
  const rows = await query(`
    SELECT ies.id, ies.name, ies.academic_year, ies.description, ies.status,
           iesm.id AS member_id, iesm.exam_period_id, iesm.sequence_order,
           iesm.maximum_marks AS configured_maximum_marks, iesm.is_required,
           ep.name AS exam_name, ep.exam_type, ep.start_date, ep.end_date,
           ep.status AS exam_period_status
    FROM institute_exam_sets ies
    JOIN institute_exam_set_members iesm ON iesm.exam_set_id = ies.id
    JOIN exam_periods ep ON ep.id = iesm.exam_period_id
    WHERE ${where}
    ORDER BY ies.id DESC, iesm.sequence_order ASC, iesm.id ASC
  `, params);
  if (rows.length === 0) {
    if (exam_set_id) return null;
    const periods = await query(`
      SELECT id, name, exam_type, sequence_order, max_contribution, start_date, end_date, status
      FROM exam_periods
      WHERE academic_year = ? AND status = 'active'
      ORDER BY sequence_order ASC, id ASC
    `, [academic_year]);
    if (periods.length === 0) return null;
    return {
      id: null,
      name: `${academic_year} Imtixaanaadka Sannadka`,
      academic_year,
      description: 'Auto-derived exam set',
      status: 'active',
      members: periods.map((p, idx) => ({
        id: p.id,
        exam_period_id: p.id,
        exam_name: p.name,
        exam_type: p.exam_type,
        sequence_order: p.sequence_order || (idx + 1),
        maximum_marks: Number(p.max_contribution) || 100,
        is_required: true,
        start_date: p.start_date,
        end_date: p.end_date,
        exam_period_status: p.status
      }))
    };
  }
  const first = rows[0];
  return {
    id: first.id,
    name: first.name,
    academic_year: first.academic_year,
    description: first.description,
    status: first.status,
    members: rows.map(row => ({
      id: row.member_id,
      exam_period_id: row.exam_period_id,
      exam_name: row.exam_name,
      exam_type: row.exam_type,
      sequence_order: row.sequence_order,
      maximum_marks: Number(row.configured_maximum_marks),
      is_required: Boolean(row.is_required),
      start_date: row.start_date,
      end_date: row.end_date,
      exam_period_status: row.exam_period_status
    }))
  };
}

async function resolveConfiguredPeriod({ exam_period, exam_period_id, academic_year }) {
  if (exam_period_id) {
    const [period] = await query(`SELECT * FROM exam_periods WHERE id = ? AND academic_year = ?`, [exam_period_id, academic_year]);
    return period || null;
  }
  if (!exam_period) return null;
  const [period] = await query(`SELECT * FROM exam_periods WHERE TRIM(name) = TRIM(?) AND academic_year = ?`, [exam_period, academic_year]);
  return period || null;
}

async function getConfiguredMember({ exam_period, exam_period_id, academic_year, exam_set_id }) {
  const period = await resolveConfiguredPeriod({ exam_period, exam_period_id, academic_year });
  if (!period) return { period: null, member: null, examSet: null };
  const examSet = await getConfiguredExamSetForYear(academic_year, exam_set_id);
  const member = examSet?.members.find(item => Number(item.exam_period_id) === Number(period.id)) || null;
  return { period, member, examSet };
}

/**
 * 1. List exams with filters
 */
export async function listExams(req, res, next) {
  try {
    const user = req.session.user;
    const { division, class_id, group_id, status, academic_year, search } = req.query;

    let instituteExams = [];
    let quranExams = [];

    const canSeeInstitute = user.role === 'super_admin' || user.division_scope === 'all' || user.division_scope === 'institute' || user.role === 'institute_admin';
    const canSeeQuran = user.role === 'super_admin' || user.division_scope === 'all' || user.division_scope === 'quran' || user.role === 'quran_admin';

    if (canSeeInstitute && (!division || division === 'institute')) {
      let sql = `
        SELECT e.id, e.title, e.academic_year, e.class_id, e.subject_id, e.exam_date,
               e.maximum_marks, e.status, e.created_by, e.created_at, e.updated_at,
               'institute' as division,
               ic.name as class_name,
               isub.name as subject_name,
               isub.code as subject_code,
               u.full_name as created_by_name,
               (SELECT COUNT(*) FROM institute_exam_marks m WHERE m.exam_id = e.id) as marks_count,
               (SELECT COUNT(*) FROM institute_enrollments ie WHERE ie.class_id = e.class_id AND ie.status = 'active') as enrolled_count
        FROM institute_exams e
        JOIN institute_classes ic ON e.class_id = ic.id
        JOIN institute_subjects isub ON e.subject_id = isub.id
        JOIN users u ON e.created_by = u.id
        WHERE 1=1
      `;
      const params = [];

      if (class_id) {
        sql += ` AND e.class_id = ?`;
        params.push(class_id);
      }
      if (academic_year) {
        sql += ` AND e.academic_year = ?`;
        params.push(academic_year);
      }
      if (status) {
        sql += ` AND e.status = ?`;
        params.push(status);
      }
      if (search) {
        sql += ` AND (e.title LIKE ? OR ic.name LIKE ? OR isub.name LIKE ?)`;
        params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
      }

      sql += ` ORDER BY e.exam_date DESC, e.id DESC`;
      instituteExams = await query(sql, params);
    }

    if (canSeeQuran && (!division || division === 'quran')) {
      let sql = `
        SELECT qe.id, qe.title, qe.academic_year, qe.group_id, qe.exam_date,
               qe.maximum_marks, qe.status, qe.created_by, qe.created_at, qe.updated_at,
               'quran' as division,
               qg.name as group_name,
               'Quraan' as subject_name,
               'QUR' as subject_code,
               u.full_name as created_by_name,
               (SELECT COUNT(*) FROM quran_exam_marks m WHERE m.exam_id = qe.id) as marks_count,
               (SELECT COUNT(*) FROM quran_enrollments qen WHERE qen.group_id = qe.group_id AND qen.status = 'active') as enrolled_count
        FROM quran_exams qe
        JOIN quran_groups qg ON qe.group_id = qg.id
        JOIN users u ON qe.created_by = u.id
        WHERE 1=1
      `;
      const params = [];

      if (group_id) {
        sql += ` AND qe.group_id = ?`;
        params.push(group_id);
      }
      if (academic_year) {
        sql += ` AND qe.academic_year = ?`;
        params.push(academic_year);
      }
      if (status) {
        sql += ` AND qe.status = ?`;
        params.push(status);
      }
      if (search) {
        sql += ` AND (qe.title LIKE ? OR qg.name LIKE ?)`;
        params.push(`%${search.trim()}%`, `%${search.trim()}%`);
      }

      sql += ` ORDER BY qe.exam_date DESC, qe.id DESC`;
      quranExams = await query(sql, params);
    }

    res.json({
      success: true,
      data: [...instituteExams, ...quranExams]
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 2. Create exam
 */
export async function createExam(req, res, next) {
  try {
    const user = req.session.user;
    const {
      division = 'institute',
      title,
      class_id,
      group_id,
      subject_id,
      academic_year = '2026',
      exam_date,
      maximum_marks = 100.00
    } = req.body;

    if (!title || !exam_date) {
      return res.status(400).json({
        success: false,
        error: 'Cinwaanka iyo taariikhda imtixaanku waa qasab.'
      });
    }

    const maxMarks = parseFloat(maximum_marks);
    if (isNaN(maxMarks) || maxMarks <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Dhibcaha ugu sarreeya (Maximum Marks) waa inay noqdaan tiro togan oo ka weyn 0.'
      });
    }

    if (division === 'institute') {
      if (!class_id || !subject_id) {
        return res.status(400).json({ success: false, error: 'Fasalka iyo maaddada waa qasab.' });
      }

      // Verify subject is assigned to this class in institute_class_subjects
      const [assigned] = await query(
        `SELECT id FROM institute_class_subjects WHERE class_id = ? AND subject_id = ?`,
        [class_id, subject_id]
      );
      if (!assigned) {
        return res.status(400).json({
          success: false,
          error: 'Maaddadan looma xilsaarin fasalkan. Fadlan dooro maaddo fasalka u qoran.'
        });
      }

      // Check duplicate examination for same class, subject, title, and academic year
      const duplicate = await query(
        `SELECT id FROM institute_exams 
         WHERE class_id = ? AND subject_id = ? AND LOWER(TRIM(title)) = LOWER(?) AND academic_year = ?`,
        [class_id, subject_id, title.trim(), academic_year]
      );

      if (duplicate.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Imtixaan leh cinwaankan ("${title.trim()}") iyo maaddadan horey ayuu ugu jiray fasalka sannadka ${academic_year}.`
        });
      }

      const result = await query(
        `INSERT INTO institute_exams (title, academic_year, class_id, subject_id, exam_date, maximum_marks, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)`,
        [title.trim(), academic_year, class_id, subject_id, exam_date, maxMarks, user.id]
      );

      await logAudit({
        userId: user.id,
        action: 'CREATE_EXAM',
        module: 'exams',
        division: 'institute',
        recordId: result.insertId,
        details: { title, class_id, subject_id, academic_year, maximum_marks: maxMarks }
      });

      return res.status(201).json({
        success: true,
        message: 'Imtixaanka Machadka si guul leh ayaa loo abuuray.',
        id: result.insertId
      });
    } else {
      // Quran division
      if (!group_id) {
        return res.status(400).json({ success: false, error: 'Halaqada Quraanka waa qasab.' });
      }

      const result = await query(
        `INSERT INTO quran_exams (title, academic_year, group_id, exam_date, maximum_marks, status, created_by)
         VALUES (?, ?, ?, ?, ?, 'draft', ?)`,
        [title.trim(), academic_year, group_id, exam_date, maxMarks, user.id]
      );

      await logAudit({
        userId: user.id,
        action: 'CREATE_EXAM',
        module: 'exams',
        division: 'quran',
        recordId: result.insertId,
        details: { title, group_id, academic_year, maximum_marks: maxMarks }
      });

      return res.status(201).json({
        success: true,
        message: 'Imtixaanka Quraanka si guul leh ayaa loo abuuray.',
        id: result.insertId
      });
    }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: 'Imtixaan leh macluumaadkan horey ayuu u jiray.' });
    }
    next(error);
  }
}

/**
 * 3. Update exam details & status
 */
export async function updateExam(req, res, next) {
  try {
    const user = req.session.user;
    const { id } = req.params;
    const {
      division = 'institute',
      title,
      class_id,
      group_id,
      subject_id,
      academic_year,
      exam_date,
      maximum_marks,
      status
    } = req.body;

    if (division === 'institute') {
      const [exam] = await query(`SELECT * FROM institute_exams WHERE id = ?`, [id]);
      if (!exam) {
        return res.status(404).json({ success: false, error: 'Imtixaanka lama helin.' });
      }

      // Check if finalized/published protection
      if ((exam.status === 'finalized' || exam.status === 'published') && status !== exam.status) {
        const canModifyFinalized = ['super_admin', 'institute_admin', 'examination_officer'].includes(user.role);
        if (!canModifyFinalized) {
          return res.status(403).json({
            success: false,
            error: 'Imtixaankan waa la dhammaystiray/la daabacay, kaliya Maamulaha ayaa beddeli kara xaaladdiisa.'
          });
        }
      }

      const newTitle = title ? title.trim() : exam.title;
      const newClassId = class_id || exam.class_id;
      const newSubjectId = subject_id || exam.subject_id;
      const newYear = academic_year || exam.academic_year;
      const newDate = exam_date || exam.exam_date;
      const newMax = maximum_marks ? parseFloat(maximum_marks) : exam.maximum_marks;
      const newStatus = status || exam.status;

      if (newMax <= 0) {
        return res.status(400).json({ success: false, error: 'Dhibcaha ugu sarreeya waa inay ka weynaadaan 0.' });
      }

      // Validate subject belongs to class
      if (newSubjectId && newClassId) {
        const [assigned] = await query(
          `SELECT id FROM institute_class_subjects WHERE class_id = ? AND subject_id = ?`,
          [newClassId, newSubjectId]
        );
        if (!assigned) {
          return res.status(400).json({
            success: false,
            error: 'Maaddada la doortay looma xilsaarin fasalkan.'
          });
        }
      }

      // Duplicate check excluding self
      const dup = await query(
        `SELECT id FROM institute_exams 
         WHERE class_id = ? AND subject_id = ? AND LOWER(TRIM(title)) = LOWER(?) AND academic_year = ? AND id != ?`,
        [newClassId, newSubjectId, newTitle, newYear, id]
      );
      if (dup.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Imtixaan kale oo leh cinwaankan ayaa horey ugu jira fasalkan sannadka ${newYear}.`
        });
      }

      await query(
        `UPDATE institute_exams 
         SET title = ?, academic_year = ?, class_id = ?, subject_id = ?,
             exam_date = ?, maximum_marks = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newTitle, newYear, newClassId, newSubjectId, newDate, newMax, newStatus, id]
      );

      await logAudit({
        userId: user.id,
        action: 'UPDATE_EXAM',
        module: 'exams',
        division: 'institute',
        recordId: id,
        details: { oldStatus: exam.status, newStatus, title: newTitle }
      });

      return res.json({ success: true, message: 'Macluumaadka imtixaanka waa la cusboonaysiiyay.' });
    } else {
      // Quran exam update
      const [exam] = await query(`SELECT * FROM quran_exams WHERE id = ?`, [id]);
      if (!exam) {
        return res.status(404).json({ success: false, error: 'Imtixaanka lama helin.' });
      }

      const newTitle = title ? title.trim() : exam.title;
      const newGroupId = group_id || exam.group_id;
      const newYear = academic_year || exam.academic_year;
      const newDate = exam_date || exam.exam_date;
      const newMax = maximum_marks ? parseFloat(maximum_marks) : exam.maximum_marks;
      const newStatus = status || exam.status;

      await query(
        `UPDATE quran_exams 
         SET title = ?, academic_year = ?, group_id = ?,
             exam_date = ?, maximum_marks = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newTitle, newYear, newGroupId, newDate, newMax, newStatus, id]
      );

      return res.json({ success: true, message: 'Macluumaadka imtixaanka Quraanka waa la cusboonaysiiyay.' });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * 4. Delete exam
 */
export async function deleteExam(req, res, next) {
  try {
    const user = req.session.user;
    const { id } = req.params;
    const { division = 'institute' } = req.query;

    if (division === 'institute') {
      const [exam] = await query(`SELECT * FROM institute_exams WHERE id = ?`, [id]);
      if (!exam) {
        return res.status(404).json({ success: false, error: 'Imtixaanka lama helin.' });
      }

      if (exam.status === 'published' && user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'Imtixaanka la daabacay lama tiri karo. Fadlan marka hore dib ugu celi Draft.'
        });
      }

      await query(`DELETE FROM institute_exam_marks WHERE exam_id = ?`, [id]);
      await query(`DELETE FROM institute_exams WHERE id = ?`, [id]);

      await logAudit({
        userId: user.id,
        action: 'DELETE_EXAM',
        module: 'exams',
        division: 'institute',
        recordId: id,
        details: { title: exam.title }
      });

      res.json({ success: true, message: 'Imtixaanka waa la tiray.' });
    } else {
      await query(`DELETE FROM quran_exam_marks WHERE exam_id = ?`, [id]);
      await query(`DELETE FROM quran_exams WHERE id = ?`, [id]);
      res.json({ success: true, message: 'Imtixaanka Quraanka waa la tiray.' });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * 5. Get exam details and marks entry sheet
 */
export async function getExamMarksSheet(req, res, next) {
  try {
    const { id } = req.params;
    const { division = 'institute' } = req.query;

    if (division === 'institute') {
      const [exam] = await query(`
        SELECT e.*, ic.name as class_name, ic.academic_year as class_year,
               isub.name as subject_name, isub.code as subject_code
        FROM institute_exams e
        JOIN institute_classes ic ON e.class_id = ic.id
        JOIN institute_subjects isub ON e.subject_id = isub.id
        WHERE e.id = ?
      `, [id]);

      if (!exam) {
        return res.status(404).json({ success: false, error: 'Imtixaanka lama helin.' });
      }

      // Load all enrolled active students for this class
      const students = await query(`
        SELECT s.id as student_id, s.student_id as student_code, s.full_name, s.gender
        FROM institute_enrollments ie
        JOIN students s ON ie.student_id = s.id
        WHERE ie.class_id = ? AND ie.status = 'active' AND s.is_active = 1
        ORDER BY s.full_name ASC
      `, [exam.class_id]);

      // Load previously saved marks
      const existingMarks = await query(`
        SELECT * FROM institute_exam_marks WHERE exam_id = ?
      `, [id]);

      const marksMap = new Map();
      existingMarks.forEach(m => marksMap.set(m.student_id, m));

      const sheet = students.map(st => {
        const mark = marksMap.get(st.student_id);
        return {
          ...st,
          marks_obtained: mark && mark.marks_obtained !== null ? mark.marks_obtained : '',
          is_absent: mark ? !!mark.is_absent : false,
          percentage: mark ? mark.percentage : null,
          grade: mark ? mark.grade : null,
          notes: mark ? mark.notes || '' : ''
        };
      });

      return res.json({
        success: true,
        data: {
          exam,
          sheet
        }
      });
    } else {
      // Quran exam sheet
      const [exam] = await query(`
        SELECT qe.*, qg.name as group_name
        FROM quran_exams qe
        JOIN quran_groups qg ON qe.group_id = qg.id
        WHERE qe.id = ?
      `, [id]);

      if (!exam) {
        return res.status(404).json({ success: false, error: 'Imtixaanka lama helin.' });
      }

      const students = await query(`
        SELECT s.id as student_id, s.student_id as student_code, s.full_name, s.gender
        FROM quran_enrollments qe
        JOIN students s ON qe.student_id = s.id
        WHERE qe.group_id = ? AND qe.status = 'active' AND s.is_active = 1
        ORDER BY s.full_name ASC
      `, [exam.group_id]);

      const existingMarks = await query(`
        SELECT * FROM quran_exam_marks WHERE exam_id = ?
      `, [id]);

      const marksMap = new Map();
      existingMarks.forEach(m => marksMap.set(m.student_id, m));

      const sheet = students.map(st => {
        const mark = marksMap.get(st.student_id);
        return {
          ...st,
          marks_obtained: mark && mark.marks_obtained !== null ? mark.marks_obtained : '',
          is_absent: mark ? !!mark.is_absent : false,
          percentage: mark ? mark.percentage : null,
          grade: mark ? mark.grade : null,
          notes: mark ? mark.notes || '' : ''
        };
      });

      return res.json({
        success: true,
        data: {
          exam,
          sheet
        }
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * 6. Save marks with validation and transactional integrity
 */
export async function saveExamMarks(req, res, next) {
  try {
    const user = req.session.user;
    const { id } = req.params;
    const { division = 'institute', marks, status } = req.body;

    if (!Array.isArray(marks)) {
      return res.status(400).json({ success: false, error: 'Xogta dhibcuhu ma dhammaystirna.' });
    }

    if (division === 'institute') {
      const [exam] = await query(`SELECT * FROM institute_exams WHERE id = ?`, [id]);
      if (!exam) {
        return res.status(404).json({ success: false, error: 'Imtixaanka lama helin.' });
      }

      // Check finalization permissions
      if (exam.status === 'published' && user.role !== 'super_admin' && user.role !== 'institute_admin') {
        return res.status(403).json({
          success: false,
          error: 'Natiijada imtixaankan horey ayaa loo daabacay, kaliya Maamulaha ayaa wax ka beddeli kara.'
        });
      }

      const maxMarks = parseFloat(exam.maximum_marks);

      await withTransaction(async (conn) => {
        for (const item of marks) {
          const isAbsent = Boolean(item.is_absent);
          let obtained = null;
          let percentage = null;
          let grade = null;

          if (isAbsent) {
            grade = 'ABS';
          } else if (item.marks_obtained !== null && item.marks_obtained !== undefined && item.marks_obtained !== '') {
            obtained = parseFloat(item.marks_obtained);
            if (isNaN(obtained) || obtained < 0 || obtained > maxMarks) {
              throw new Error(`Dhibcuhu waa inay u dhexeeyaan 0 iyo ${maxMarks}. Ardayga ID: ${item.student_id}`);
            }
            percentage = Number(((obtained / maxMarks) * 100).toFixed(2));
          }

          await conn.execute(
            `INSERT INTO institute_exam_marks (exam_id, student_id, marks_obtained, is_absent, percentage, grade, notes, entered_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
               marks_obtained = VALUES(marks_obtained),
               is_absent = VALUES(is_absent),
               percentage = VALUES(percentage),
               grade = VALUES(grade),
               notes = VALUES(notes),
               entered_by = VALUES(entered_by)`,
            [id, item.student_id, obtained, isAbsent, percentage, grade, item.notes || null, user.id]
          );
        }

        const validStatuses = ['draft', 'marks_entry', 'finalized', 'published'];
        const targetStatus = status && validStatuses.includes(status) ? status : (exam.status === 'draft' ? 'marks_entry' : exam.status);

        await conn.execute(
          `UPDATE institute_exams SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [targetStatus, id]
        );
      });

      await logAudit({
        userId: user.id,
        action: status === 'published' ? 'PUBLISH_EXAM_RESULTS' : 'SAVE_EXAM_MARKS',
        module: 'exams',
        division: 'institute',
        recordId: id,
        details: `Saved marks for Institute exam ${id} (${marks.length} students), status: ${status || exam.status}`,
        ipAddress: req.ip
      });

      return res.json({
        success: true,
        message: 'Dhibcaha imtixaanka si guul leh ayaa loo kaydiyay.'
      });
    } else {
      // Quran marks
      const [exam] = await query(`SELECT * FROM quran_exams WHERE id = ?`, [id]);
      if (!exam) {
        return res.status(404).json({ success: false, error: 'Imtixaanka lama helin.' });
      }

      const maxMarks = parseFloat(exam.maximum_marks);

      await withTransaction(async (conn) => {
        for (const item of marks) {
          const isAbsent = Boolean(item.is_absent);
          let obtained = null;
          let percentage = null;
          let grade = null;

          if (isAbsent) {
            grade = 'ABS';
          } else if (item.marks_obtained !== null && item.marks_obtained !== undefined && item.marks_obtained !== '') {
            obtained = parseFloat(item.marks_obtained);
            if (isNaN(obtained) || obtained < 0 || obtained > maxMarks) {
              throw new Error(`Dhibcuhu waa inay u dhexeeyaan 0 iyo ${maxMarks}. Ardayga ID: ${item.student_id}`);
            }
            percentage = Number(((obtained / maxMarks) * 100).toFixed(2));
          }

          await conn.execute(
            `INSERT INTO quran_exam_marks (exam_id, student_id, marks_obtained, is_absent, percentage, grade, notes, entered_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
               marks_obtained = VALUES(marks_obtained),
               is_absent = VALUES(is_absent),
               percentage = VALUES(percentage),
               grade = VALUES(grade),
               notes = VALUES(notes),
               entered_by = VALUES(entered_by)`,
            [id, item.student_id, obtained, isAbsent, percentage, grade, item.notes || null, user.id]
          );
        }

        const validStatuses = ['draft', 'marks_entry', 'finalized', 'published'];
        const targetStatus = status && validStatuses.includes(status) ? status : (exam.status === 'draft' ? 'marks_entry' : exam.status);

        await conn.execute(
          `UPDATE quran_exams SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [targetStatus, id]
        );
      });

      await logAudit({
        userId: user.id,
        action: status === 'published' ? 'PUBLISH_EXAM_RESULTS' : 'SAVE_EXAM_MARKS',
        module: 'exams',
        division: 'quran',
        recordId: id,
        details: `Saved marks for Quran exam ${id} (${marks.length} students)`,
        ipAddress: req.ip
      });

      return res.json({
        success: true,
        message: 'Dhibcaha imtixaanka Quraanka si guul leh ayaa loo kaydiyay.'
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Helper: Compute competition ranking and whole-class sheet
 */
async function computeClassResultsData({ class_id, academic_year = '2026', exam_title = '' }) {
  const [cls] = await query(`SELECT * FROM institute_classes WHERE id = ?`, [class_id]);
  if (!cls) {
    throw new Error('Fasalka lama helin.');
  }

  // Find all exams matching class_id, academic_year, and optional title
  let examSql = `
    SELECT e.id as exam_id, e.title, e.subject_id, e.maximum_marks, e.exam_date, e.status,
           s.name as subject_name, s.code as subject_code
    FROM institute_exams e
    JOIN institute_subjects s ON e.subject_id = s.id
    WHERE e.class_id = ?
  `;
  const examParams = [class_id];

  if (academic_year) {
    examSql += ` AND e.academic_year = ?`;
    examParams.push(academic_year);
  }

  const isFirstHalfRequested = ['first_half', 'half_1', 'النصف الأول (Wadarta 100ka)'].includes(exam_title);
  const isSecondHalfRequested = ['second_half', 'half_2', 'النصف الثاني (Wadarta 100ka)'].includes(exam_title);

  if (isFirstHalfRequested) {
    examSql += ` AND e.title IN ('النصف الأول', 'النهائي الأول')`;
  } else if (isSecondHalfRequested) {
    examSql += ` AND e.title IN ('النصف الثاني', 'النهائي الثاني')`;
  } else if (exam_title && exam_title !== 'all') {
    examSql += ` AND e.title = ?`;
    examParams.push(exam_title);
  }

  examSql += ` ORDER BY s.name ASC, e.id ASC`;
  const exams = await query(examSql, examParams);

  if (exams.length === 0) {
    return {
      class_info: cls,
      subjects: [],
      exams: [],
      students: [],
      total_students: 0,
      maximum_total: 0,
      exam_title: exam_title || 'Dhammaan Imtixaanaadka'
    };
  }

  // Load all eligible enrolled students in this class
  const students = await query(`
    SELECT s.id as student_id, s.student_id as student_code, s.full_name as student_name, s.gender
    FROM institute_enrollments ie
    JOIN students s ON ie.student_id = s.id
    WHERE ie.class_id = ? AND ie.status = 'active' AND s.is_active = 1
    ORDER BY s.full_name ASC
  `, [class_id]);

  // Load all marks for these exams
  const examIds = exams.map(e => e.exam_id);
  const marks = await query(`
    SELECT m.exam_id, m.student_id, m.marks_obtained, m.is_absent, m.percentage, m.grade, m.notes
    FROM institute_exam_marks m
    WHERE m.exam_id IN (${examIds.map(() => '?').join(',')})
  `, examIds);

  const marksMap = new Map();
  marks.forEach(m => {
    marksMap.set(`${m.student_id}_${m.exam_id}`, m);
  });

  // Load assessment config for this academic year
  const [assessmentConfig] = await query(
    `SELECT * FROM academic_year_assessment_configs WHERE academic_year = ?`,
    [academic_year]
  );
  const passThreshold = assessmentConfig ? parseFloat(assessmentConfig.pass_threshold) : 50.00;

  // Identify distinct subjects
  const subjectMap = new Map();
  exams.forEach(ex => {
    if (!subjectMap.has(ex.subject_id)) {
      subjectMap.set(ex.subject_id, {
        id: ex.subject_id,
        name: ex.subject_name,
        code: ex.subject_code,
        exams: []
      });
    }
    subjectMap.get(ex.subject_id).exams.push(ex);
  });
  const distinctSubjects = Array.from(subjectMap.values());

  // Build each student's results
  const computedStudents = students.map(st => {
    let totalObtained = 0;
    let validMaxTotal = 0;
    let pendingCount = 0;
    let absentCount = 0;
    let enteredCount = 0;
    const subjectMarks = {};

    exams.forEach(ex => {
      const key = `${st.student_id}_${ex.exam_id}`;
      const m = marksMap.get(key);

      if (!m || (m.marks_obtained === null && !m.is_absent)) {
        pendingCount++;
        subjectMarks[ex.exam_id] = {
          obtained: null,
          display: '—',
          status: 'pending',
          is_absent: false
        };
      } else if (m.is_absent) {
        absentCount++;
        enteredCount++;
        validMaxTotal += parseFloat(ex.maximum_marks || 0);
        subjectMarks[ex.exam_id] = {
          obtained: 0,
          display: 'ABS',
          status: 'absent',
          is_absent: true
        };
      } else {
        const val = parseFloat(m.marks_obtained);
        totalObtained += val;
        enteredCount++;
        validMaxTotal += parseFloat(ex.maximum_marks || 0);
        subjectMarks[ex.exam_id] = {
          obtained: val,
          display: val.toString(),
          status: 'present',
          is_absent: false
        };
      }
    });

    // Compute Two-Half breakdown per subject:
    // First Half: النصف الأول (40) + النهائي الأول (60) = 100
    // Second Half: النصف الثاني (40) + النهائي الثاني (60) = 100
    const subjectHalves = {};
    let half1Total = 0;
    let half1Max = 0;
    let half1EnteredCount = 0;
    let half1PendingCount = 0;

    let half2Total = 0;
    let half2Max = 0;
    let half2EnteredCount = 0;
    let half2PendingCount = 0;

    distinctSubjects.forEach(sub => {
      const h1MidExam = exams.find(e => e.subject_id === sub.id && e.title === 'النصف الأول');
      const h1FinExam = exams.find(e => e.subject_id === sub.id && e.title === 'النهائي الأول');
      const h2MidExam = exams.find(e => e.subject_id === sub.id && e.title === 'النصف الثاني');
      const h2FinExam = exams.find(e => e.subject_id === sub.id && e.title === 'النهائي الثاني');

      const m_h1_mid = h1MidExam ? marksMap.get(`${st.student_id}_${h1MidExam.exam_id}`) : null;
      const m_h1_fin = h1FinExam ? marksMap.get(`${st.student_id}_${h1FinExam.exam_id}`) : null;
      const m_h2_mid = h2MidExam ? marksMap.get(`${st.student_id}_${h2MidExam.exam_id}`) : null;
      const m_h2_fin = h2FinExam ? marksMap.get(`${st.student_id}_${h2FinExam.exam_id}`) : null;

      let subH1Val = 0;
      let subH1Max = 0;
      let hasH1Marks = false;
      let isH1Complete = true;

      if (h1MidExam || h1FinExam) {
        if (h1MidExam) {
          subH1Max += 40;
          if (m_h1_mid && (m_h1_mid.marks_obtained !== null || m_h1_mid.is_absent)) {
            hasH1Marks = true;
            half1EnteredCount++;
            subH1Val += m_h1_mid.is_absent ? 0 : parseFloat(m_h1_mid.marks_obtained || 0);
          } else {
            isH1Complete = false;
            half1PendingCount++;
          }
        }
        if (h1FinExam) {
          subH1Max += 60;
          if (m_h1_fin && (m_h1_fin.marks_obtained !== null || m_h1_fin.is_absent)) {
            hasH1Marks = true;
            half1EnteredCount++;
            subH1Val += m_h1_fin.is_absent ? 0 : parseFloat(m_h1_fin.marks_obtained || 0);
          } else {
            isH1Complete = false;
            half1PendingCount++;
          }
        }
        if (hasH1Marks) half1Total += subH1Val;
        half1Max += subH1Max;
      }

      let subH2Val = 0;
      let subH2Max = 0;
      let hasH2Marks = false;
      let isH2Complete = true;

      if (h2MidExam || h2FinExam) {
        if (h2MidExam) {
          subH2Max += 40;
          if (m_h2_mid && (m_h2_mid.marks_obtained !== null || m_h2_mid.is_absent)) {
            hasH2Marks = true;
            half2EnteredCount++;
            subH2Val += m_h2_mid.is_absent ? 0 : parseFloat(m_h2_mid.marks_obtained || 0);
          } else {
            isH2Complete = false;
            half2PendingCount++;
          }
        }
        if (h2FinExam) {
          subH2Max += 60;
          if (m_h2_fin && (m_h2_fin.marks_obtained !== null || m_h2_fin.is_absent)) {
            hasH2Marks = true;
            half2EnteredCount++;
            subH2Val += m_h2_fin.is_absent ? 0 : parseFloat(m_h2_fin.marks_obtained || 0);
          } else {
            isH2Complete = false;
            half2PendingCount++;
          }
        }
        if (hasH2Marks) half2Total += subH2Val;
        half2Max += subH2Max;
      }

      subjectHalves[sub.id] = {
        subject_id: sub.id,
        subject_name: sub.name,
        h1_mid: m_h1_mid ? (m_h1_mid.is_absent ? 'ABS' : m_h1_mid.marks_obtained) : '—',
        h1_final: m_h1_fin ? (m_h1_fin.is_absent ? 'ABS' : m_h1_fin.marks_obtained) : '—',
        h1_total: hasH1Marks ? Number(subH1Val.toFixed(2)) : null,
        h1_status: isH1Complete && (h1MidExam || h1FinExam) ? 'completed' : (hasH1Marks ? 'provisional' : 'pending'),
        h2_mid: m_h2_mid ? (m_h2_mid.is_absent ? 'ABS' : m_h2_mid.marks_obtained) : '—',
        h2_final: m_h2_fin ? (m_h2_fin.is_absent ? 'ABS' : m_h2_fin.marks_obtained) : '—',
        h2_total: hasH2Marks ? Number(subH2Val.toFixed(2)) : null,
        h2_status: isH2Complete && (h2MidExam || h2FinExam) ? 'completed' : (hasH2Marks ? 'provisional' : 'pending'),
        annual_total: (hasH1Marks || hasH2Marks) ? Number((subH1Val + subH2Val).toFixed(2)) : null
      };
    });

    const hasSavedMarks = enteredCount > 0;
    const isIncomplete = pendingCount > 0;

    const firstHalfHasMarks = half1EnteredCount > 0;
    const isFirstHalfIncomplete = half1PendingCount > 0;
    const firstHalfPercentage = firstHalfHasMarks && half1Max > 0
      ? Number(((half1Total / half1Max) * 100).toFixed(2))
      : 0;
    const firstHalfStatus = isFirstHalfIncomplete
      ? (firstHalfHasMarks ? 'Dhiman (Provisional)' : 'Lama gelin')
      : 'Dhammaystiran (Completed)';

    const secondHalfHasMarks = half2EnteredCount > 0;
    const isSecondHalfIncomplete = half2PendingCount > 0;
    const secondHalfPercentage = secondHalfHasMarks && half2Max > 0
      ? Number(((half2Total / half2Max) * 100).toFixed(2))
      : 0;
    const secondHalfStatus = isSecondHalfIncomplete
      ? (secondHalfHasMarks ? 'Dhiman (Provisional)' : 'Lama gelin')
      : 'Dhammaystiran (Completed)';

    let finalTotalObtained = totalObtained;
    let finalMaxTotal = exams.reduce((sum, e) => sum + parseFloat(e.maximum_marks || 0), 0);
    let finalPercentage = 0;
    let finalStatus = isIncomplete ? 'Dhiman (Provisional)' : 'Dhammaystiran (Completed)';

    if (isFirstHalfRequested) {
      finalTotalObtained = half1Total;
      finalMaxTotal = half1Max;
      finalPercentage = firstHalfPercentage;
      finalStatus = firstHalfStatus;
    } else if (isSecondHalfRequested) {
      finalTotalObtained = half2Total;
      finalMaxTotal = half2Max;
      finalPercentage = secondHalfPercentage;
      finalStatus = secondHalfStatus;
    } else {
      finalPercentage = isIncomplete
        ? (validMaxTotal > 0 ? Number(((totalObtained / validMaxTotal) * 100).toFixed(2)) : 0)
        : (finalMaxTotal > 0 ? Number(((totalObtained / finalMaxTotal) * 100).toFixed(2)) : 0);
    }

    return {
      student_id: st.student_id,
      student_code: st.student_code,
      student_name: st.student_name,
      gender: st.gender,
      subject_marks: subjectMarks,
      subjects: subjectMarks,
      subject_halves: subjectHalves,
      first_half: {
        total_obtained: Number(half1Total.toFixed(2)),
        maximum_total: half1Max,
        percentage: firstHalfPercentage,
        is_provisional: isFirstHalfIncomplete,
        is_complete: !isFirstHalfIncomplete && firstHalfHasMarks,
        status: firstHalfStatus
      },
      second_half: {
        total_obtained: Number(half2Total.toFixed(2)),
        maximum_total: half2Max,
        percentage: secondHalfPercentage,
        is_provisional: isSecondHalfIncomplete,
        is_complete: !isSecondHalfIncomplete && secondHalfHasMarks,
        status: secondHalfStatus
      },
      total_obtained: Number(finalTotalObtained.toFixed(2)),
      maximum_total: finalMaxTotal,
      valid_max_total: validMaxTotal,
      average_percentage: finalPercentage,
      has_saved_marks: hasSavedMarks,
      is_incomplete: isFirstHalfRequested ? isFirstHalfIncomplete : (isSecondHalfRequested ? isSecondHalfIncomplete : isIncomplete),
      is_provisional: isFirstHalfRequested ? isFirstHalfIncomplete : (isSecondHalfRequested ? isSecondHalfIncomplete : isIncomplete),
      pending_count: pendingCount,
      absent_count: absentCount,
      result_status: finalStatus
    };
  });

  // Sort descending by total_obtained, then ascending by student_name
  computedStudents.sort((a, b) => {
    if (b.total_obtained !== a.total_obtained) {
      return b.total_obtained - a.total_obtained;
    }
    return a.student_name.localeCompare(b.student_name);
  });

  // Assign competition rank (kept for internal reference, hidden from display)
  for (let i = 0; i < computedStudents.length; i++) {
    if (i === 0) {
      computedStudents[i].rank = 1;
    } else {
      if (computedStudents[i].total_obtained === computedStudents[i - 1].total_obtained) {
        computedStudents[i].rank = computedStudents[i - 1].rank;
      } else {
        computedStudents[i].rank = i + 1;
      }
    }
  }

  const effectiveMaxTotal = isFirstHalfRequested
    ? (distinctSubjects.length * 100)
    : (isSecondHalfRequested ? (distinctSubjects.length * 100) : exams.reduce((sum, e) => sum + parseFloat(e.maximum_marks || 0), 0));

  let displayTitle = exam_title || 'Dhammaan Imtixaanaadka';
  if (isFirstHalfRequested) {
    displayTitle = 'Niska 1-aad — النصف الأول (Wadarta 100ka)';
  } else if (isSecondHalfRequested) {
    displayTitle = 'Niska 2-aad — النصف الثاني (Wadarta 100ka)';
  }

  return {
    class_info: cls,
    academic_year,
    exam_title: displayTitle,
    raw_exam_title: exam_title,
    is_first_half: isFirstHalfRequested,
    is_second_half: isSecondHalfRequested,
    pass_threshold: passThreshold,
    distinct_subjects: distinctSubjects,
    subjects: distinctSubjects,
    exams,
    maximum_total: effectiveMaxTotal,
    total_students: computedStudents.length,
    students: computedStudents
  };
}

/**
 * Computes results from an administrator-configured connected exam set.
 * A midterm view contains one configured member. A final view combines only
 * the required members from the same set and never mixes academic years.
 */
async function computeConnectedClassResultsData({ class_id, academic_year = '2026', exam_set_id, mode = 'final', exam_period_id }) {
  const [cls] = await query(`SELECT * FROM institute_classes WHERE id = ?`, [class_id]);
  if (!cls) throw new Error('Fasalka lama helin.');

  const examSet = await getConfiguredExamSetForYear(academic_year, exam_set_id);
  if (!examSet) {
    throw Object.assign(new Error(`Ma jiro connected examination set loo qaabeeyay sannadka ${academic_year}.`), { status: 409 });
  }

  let members = examSet.members;
  if (mode === 'member') {
    members = examSet.members.filter(member => Number(member.exam_period_id) === Number(exam_period_id));
    if (members.length === 0) {
      throw Object.assign(new Error('Imtixaanka la doortay kuma jiro connected examination set-ka.'), { status: 400 });
    }
  } else {
    members = examSet.members.filter(member => member.is_required);
  }

  const students = await query(`
    SELECT s.id AS student_id, s.student_id AS student_code, s.full_name AS student_name, s.gender
    FROM institute_enrollments ie
    JOIN students s ON s.id = ie.student_id
    WHERE ie.class_id = ? AND ie.status = 'active' AND s.is_active = 1
    ORDER BY s.full_name ASC
  `, [class_id]);

  let subjects = await query(`
    SELECT s.id, s.name, s.code
    FROM institute_class_subjects cs
    JOIN institute_subjects s ON s.id = cs.subject_id
    WHERE cs.class_id = ? AND s.is_active = 1
    ORDER BY s.name ASC
  `, [class_id]);
  if (subjects.length === 0) {
    subjects = await query(`
      SELECT id, name, code
      FROM institute_subjects
      WHERE is_active = 1
      ORDER BY name ASC
    `);
  }

  const periodIds = members.map(member => member.exam_period_id);
  const examRows = periodIds.length > 0 ? await query(`
    SELECT e.id AS exam_id, e.subject_id, e.title, e.academic_year, e.maximum_marks,
           e.exam_date, e.status, e.exam_set_id, ep.id AS exam_period_id,
           ep.name AS exam_name, ep.exam_type, s.name AS subject_name, s.code AS subject_code
    FROM institute_exams e
    JOIN exam_periods ep ON BINARY ep.name = BINARY e.title AND BINARY ep.academic_year = BINARY e.academic_year
    JOIN institute_subjects s ON s.id = e.subject_id
    WHERE e.class_id = ? AND e.academic_year = ?
      AND ep.id IN (${periodIds.map(() => '?').join(',')})
      AND (e.exam_set_id = ? OR ? IS NULL OR e.exam_set_id IS NULL)
    ORDER BY s.name ASC, ep.id ASC, e.id ASC
  `, [class_id, academic_year, ...periodIds, examSet.id, examSet.id]) : [];

  const examMap = new Map();
  examRows.forEach(exam => examMap.set(`${exam.subject_id}_${exam.exam_period_id}`, exam));
  const examIds = examRows.map(exam => exam.exam_id);
  const markRows = examIds.length > 0 ? await query(`
    SELECT exam_id, student_id, marks_obtained, is_absent, percentage, grade, notes
    FROM institute_exam_marks
    WHERE exam_id IN (${examIds.map(() => '?').join(',')})
  `, examIds) : [];
  const markMap = new Map(markRows.map(mark => [`${mark.student_id}_${mark.exam_id}`, mark]));

  const resultSubjects = subjects.map(subject => {
    const subjectMembers = members.map(member => ({
      ...member,
      exam: examMap.get(`${subject.id}_${member.exam_period_id}`) || null
    }));
    const maximumMarks = subjectMembers.reduce((sum, member) => sum + Number(member.maximum_marks || 0), 0);
    return { ...subject, maximum_marks: maximumMarks, members: subjectMembers };
  });

  const computedStudents = students.map(student => {
    let total = 0;
    let maximumTotal = 0;
    let partialTotal = 0;
    let pendingCount = 0;
    let enteredCount = 0;
    let absentCount = 0;
    const subjectResults = {};
    const subjectMarks = {};

    resultSubjects.forEach(subject => {
      let subjectTotal = 0;
      let subjectMaximum = 0;
      let subjectPending = 0;
      const components = {};
      subject.members.forEach(member => {
        subjectMaximum += Number(member.maximum_marks || 0);
        const exam = member.exam;
        const mark = exam ? markMap.get(`${student.student_id}_${exam.exam_id}`) : null;
        const key = `${subject.id}_${member.exam_period_id}`;
        if (!mark || (mark.marks_obtained === null && !mark.is_absent)) {
          subjectPending += 1;
          pendingCount += 1;
          components[member.exam_period_id] = { obtained: null, display: '—', status: 'pending', maximum_marks: member.maximum_marks, exam_name: member.exam_name };
          subjectMarks[key] = components[member.exam_period_id];
        } else {
          const obtained = mark.is_absent ? 0 : Number(mark.marks_obtained);
          if (mark.is_absent) absentCount += 1;
          else enteredCount += 1;
          subjectTotal += obtained;
          partialTotal += obtained;
          components[member.exam_period_id] = { obtained, display: mark.is_absent ? 'ABS' : String(obtained), status: mark.is_absent ? 'absent' : 'present', maximum_marks: member.maximum_marks, exam_name: member.exam_name };
          subjectMarks[key] = components[member.exam_period_id];
        }
      });
      const isComplete = subjectPending === 0 && subject.members.length > 0;
      subjectResults[subject.id] = {
        subject_id: subject.id,
        subject_name: subject.name,
        combined_total: isComplete ? Number(subjectTotal.toFixed(2)) : null,
        partial_total: Number(subjectTotal.toFixed(2)),
        maximum_marks: Number(subjectMaximum.toFixed(2)),
        status: isComplete ? 'completed' : (subjectTotal > 0 ? 'incomplete' : 'pending'),
        components
      };
      maximumTotal += subjectMaximum;
      if (isComplete) total += subjectTotal;
    });

    const isIncomplete = resultSubjects.length === 0 || Object.values(subjectResults).some(result => result.status !== 'completed');
    const hasSavedMarks = enteredCount > 0 || absentCount > 0;
    const totalObtained = isIncomplete ? null : Number(total.toFixed(2));
    const averagePercentage = !isIncomplete && maximumTotal > 0
      ? Number(((total / maximumTotal) * 100).toFixed(2))
      : null;

    return {
      student_id: student.student_id,
      student_code: student.student_code,
      student_name: student.student_name,
      full_name: student.student_name,
      gender: student.gender,
      subject_results: subjectResults,
      subject_marks: subjectMarks,
      subjects: subjectResults,
      total_obtained: totalObtained,
      partial_total: Number(partialTotal.toFixed(2)),
      maximum_total: Number(maximumTotal.toFixed(2)),
      average_percentage: averagePercentage,
      has_saved_marks: hasSavedMarks,
      is_incomplete: isIncomplete,
      is_provisional: isIncomplete,
      pending_count: pendingCount,
      absent_count: absentCount,
      result_status: isIncomplete ? 'Dhiman (Provisional)' : 'Dhammaystiran (Completed)'
    };
  });

  computedStudents.sort((a, b) => {
    const bValue = b.average_percentage ?? -1;
    const aValue = a.average_percentage ?? -1;
    return bValue - aValue || a.student_name.localeCompare(b.student_name);
  });
  computedStudents.forEach((student, index) => { student.rank = index + 1; });

  const isMidtermResult = mode === 'member';
  return {
    class_info: cls,
    academic_year,
    exam_title: isMidtermResult ? members[0].exam_name : `${examSet.name} — Final Combined Results`,
    raw_exam_title: isMidtermResult ? members[0].exam_name : 'final_combined',
    is_configured_result: true,
    is_combined_result: !isMidtermResult,
    is_midterm_result: isMidtermResult,
    exam_set: examSet,
    result_members: members,
    distinct_subjects: resultSubjects.map(subject => ({ id: subject.id, name: subject.name, code: subject.code, maximum_marks: subject.maximum_marks })),
    subjects: resultSubjects.map(subject => ({ id: subject.id, name: subject.name, code: subject.code, maximum_marks: subject.maximum_marks })),
    exams: isMidtermResult ? examRows : [],
    maximum_total: resultSubjects.reduce((sum, subject) => sum + Number(subject.maximum_marks || 0), 0),
    total_students: computedStudents.length,
    students: computedStudents
  };
}

async function computeAnnualPromotionResults({ class_id, academic_year }) {
  const examSet = await getConfiguredExamSetForYear(academic_year);
  if (examSet) {
    return computeConnectedClassResultsData({ class_id, academic_year, exam_set_id: examSet.id, mode: 'final' });
  }
  return computeClassResultsData({ class_id, academic_year, exam_title: 'all' });
}

/**
 * 7. Get Whole-Class Results Sheet
 */
export async function getClassResultsSheet(req, res, next) {
  try {
    const { class_id, academic_year = '2026', exam_title = '' } = req.query;

    if (!class_id) {
      return res.status(400).json({ success: false, error: 'Fasalka (class_id) waa qasab.' });
    }

    const data = exam_title === 'final_combined'
      ? await computeAnnualPromotionResults({ class_id, academic_year })
      : exam_title === 'configured_midterm'
        ? await computeConnectedClassResultsData({ class_id, academic_year, exam_set_id: req.query.exam_set_id, mode: 'member', exam_period_id: req.query.exam_period_id })
        : await computeClassResultsData({ class_id, academic_year, exam_title });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * 8. Export Whole-Class Results to Genuine Excel (.xlsx)
 * Strictly orders students descending by total, no Rank column, excludes students without saved marks
 */
export async function exportClassResultsExcel(req, res, next) {
  try {
    const { class_id, academic_year = '2026', exam_title = '' } = req.query;

    if (!class_id) {
      return res.status(400).json({ success: false, error: 'Fasalka (class_id) waa qasab.' });
    }

    const data = exam_title === 'final_combined'
      ? await computeAnnualPromotionResults({ class_id, academic_year })
      : exam_title === 'configured_midterm'
        ? await computeConnectedClassResultsData({ class_id, academic_year, exam_set_id: req.query.exam_set_id, mode: 'member', exam_period_id: req.query.exam_period_id })
        : await computeClassResultsData({ class_id, academic_year, exam_title });
    const { class_info, exams, distinct_subjects, is_first_half, is_second_half, students, maximum_total } = data;

    // Exclude students with no saved marks
    const eligibleStudents = students.filter(s => s.has_saved_marks !== false);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'معهد التفسير للعلوم الشرعية والعربية';
    const sheet = workbook.addWorksheet('Natiijada Fasalka');

    const isConfiguredView = data.is_configured_result;
    const isHalfView = is_first_half || is_second_half || isConfiguredView;
    const colCount = 3 + (isHalfView ? distinct_subjects.length : exams.length) + 4;

    sheet.mergeCells(1, 1, 1, colCount);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = 'معهد التفسير للعلوم الشرعية والعربية - Warqadda Natiijada Fasalka';
    titleCell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };

    sheet.mergeCells(2, 1, 2, colCount);
    const metaCell = sheet.getCell(2, 1);
    metaCell.value = `Fasalka: ${class_info.name} | Sannadka: ${academic_year} | Imtixaanka: ${data.exam_title}`;
    metaCell.font = { size: 11, bold: true, italic: true };
    metaCell.alignment = { horizontal: 'center' };

    sheet.addRow([]);

    // Table Headers (No Rank Column - auto-ordered from highest to lowest total)
    const headers = [
      'No.',
      'Aqoonsiga (ID)',
      'Magaca Ardayga'
    ];

    if (isHalfView) {
      distinct_subjects.forEach(sub => {
        headers.push(`${sub.name} (Max: ${sub.maximum_marks ?? ''})`);
      });
    } else {
      exams.forEach(ex => {
        headers.push(`${ex.subject_name} (${ex.maximum_marks})`);
      });
    }

    headers.push('Wadarta (Total)');
    headers.push('Ugu Badan (Max)');
    headers.push('Boqolkiiba (%)');
    headers.push('Xaaladda');

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Student Rows
    eligibleStudents.forEach((st, idx) => {
      const rowData = [
        idx + 1,
        sanitizeForExcel(st.student_code),
        sanitizeForExcel(st.student_name)
      ];

      if (data.is_configured_result) {
        distinct_subjects.forEach(sub => {
          const subjectResult = st.subject_results?.[sub.id];
          rowData.push(subjectResult?.combined_total ?? '—');
        });
      } else if (isHalfView) {
        distinct_subjects.forEach(sub => {
          const sh = st.subject_halves?.[sub.id];
          const halfTotal = is_first_half ? sh?.h1_total : sh?.h2_total;
          const halfStatus = is_first_half ? sh?.h1_status : sh?.h2_status;

          if (halfTotal !== null && halfTotal !== undefined) {
            rowData.push(halfStatus === 'provisional' ? `${halfTotal} (KMG)` : halfTotal);
          } else {
            rowData.push('—');
          }
        });
      } else {
        exams.forEach(ex => {
          const sm = st.subject_marks[ex.exam_id];
          if (sm) {
            if (sm.status === 'present') {
              rowData.push(sm.obtained);
            } else if (sm.status === 'absent') {
              rowData.push('ABS');
            } else {
              rowData.push('—');
            }
          } else {
            rowData.push('—');
          }
        });
      }

      rowData.push(st.total_obtained);
      rowData.push(maximum_total);
      rowData.push(`${st.average_percentage}%`);
      rowData.push(st.result_status);

      const studentRow = sheet.addRow(rowData);
      studentRow.alignment = { vertical: 'middle' };
      // Bold the total
      studentRow.getCell(colCount - 3).font = { bold: true };
    });

    // Auto-fit column widths
    sheet.columns = [
      { width: 8 },
      { width: 16 },
      { width: 30 },
      ...(isHalfView ? distinct_subjects : exams).map(() => ({ width: 22 })),
      { width: 16 },
      { width: 14 },
      { width: 16 },
      { width: 24 }
    ];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=natiijada-${class_info.name.replace(/\s+/g, '_')}-${academic_year}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
}

/**
 * 9. Get Individual Student Result Sheet
 */
export async function getStudentResultSheet(req, res, next) {
  try {
    const { student_id } = req.params;
    const { class_id, academic_year = '2026', exam_title = '' } = req.query;

    if (!student_id || !class_id) {
      return res.status(400).json({ success: false, error: 'Student ID iyo Class ID waa qasab.' });
    }

    // Load full class computation to determine correct relative class rank
    const classData = exam_title === 'final_combined'
      ? await computeAnnualPromotionResults({ class_id, academic_year })
      : exam_title === 'configured_midterm'
        ? await computeConnectedClassResultsData({ class_id, academic_year, exam_set_id: req.query.exam_set_id, mode: 'member', exam_period_id: req.query.exam_period_id })
        : await computeClassResultsData({ class_id, academic_year, exam_title });
    const studentResult = classData.students.find(s => String(s.student_id) === String(student_id));

    if (!studentResult) {
      return res.status(404).json({ success: false, error: 'Ardayga lama helin ama kuma qorna fasalkan.' });
    }

    // Format subject breakdown list
    const subjectBreakdown = classData.is_configured_result
      ? (classData.distinct_subjects || []).map(subject => {
        const result = studentResult.subject_results?.[subject.id];
        return {
          exam_id: null,
          exam_title: classData.exam_title,
          subject_id: subject.id,
          subject_name: subject.name,
          subject_code: subject.code,
          maximum_marks: subject.maximum_marks,
          marks_obtained: result?.combined_total ?? null,
          display: result?.combined_total ?? '-',
          status: result?.status || 'pending',
          percentage: result?.combined_total !== null && result?.combined_total !== undefined
            ? Number(((result.combined_total / subject.maximum_marks) * 100).toFixed(2))
            : null
        };
      })
      : classData.exams.map(ex => {
      const sm = studentResult.subject_marks[ex.exam_id];
      const max = parseFloat(ex.maximum_marks);
      const obt = sm && sm.status === 'present' ? sm.obtained : null;
      const pct = obt !== null ? Number(((obt / max) * 100).toFixed(2)) : null;

      return {
        exam_id: ex.exam_id,
        exam_title: ex.title,
        subject_id: ex.subject_id,
        subject_name: ex.subject_name,
        subject_code: ex.subject_code,
        maximum_marks: max,
        marks_obtained: obt,
        display: sm ? sm.display : '-',
        status: sm ? sm.status : 'pending',
        percentage: pct
      };
      });

    res.json({
      success: true,
      data: {
        institute_name: 'معهد التفسير للعلوم الشرعية والعربية',
        document_title: 'Warqadda Natiijada Ardayga (Student Examination Result)',
        academic_year,
        exam_title: classData.exam_title,
        class_info: classData.class_info,
        total_students_in_class: classData.total_students,
        student: {
          student_id: studentResult.student_id,
          student_code: studentResult.student_code,
          student_name: studentResult.student_name,
          gender: studentResult.gender,
          rank: studentResult.rank,
          total_obtained: studentResult.total_obtained,
          maximum_total: studentResult.maximum_total,
          average_percentage: studentResult.average_percentage,
          result_status: studentResult.result_status,
          is_incomplete: studentResult.is_incomplete
        },
        subjects: subjectBreakdown
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 10. Export Individual Student Result to Genuine Excel (.xlsx)
 */
export async function exportStudentResultExcel(req, res, next) {
  try {
    const { student_id } = req.params;
    const { class_id, academic_year = '2026', exam_title = '' } = req.query;

    const classData = exam_title === 'final_combined'
      ? await computeAnnualPromotionResults({ class_id, academic_year })
      : exam_title === 'configured_midterm'
        ? await computeConnectedClassResultsData({ class_id, academic_year, exam_set_id: req.query.exam_set_id, mode: 'member', exam_period_id: req.query.exam_period_id })
        : await computeClassResultsData({ class_id, academic_year, exam_title });
    const st = classData.students.find(s => String(s.student_id) === String(student_id));

    if (!st) {
      return res.status(404).json({ success: false, error: 'Ardayga lama helin.' });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'معهد التفسير للعلوم الشرعية والعربية';
    const sheet = workbook.addWorksheet('Natiijada Ardayga');

    // Title
    sheet.mergeCells('A1:E1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'معهد التفسير للعلوم الشرعية والعربية - Warqadda Natiijada Ardayga';
    titleCell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };

    sheet.addRow([]);
    sheet.addRow(['Magaca Ardayga:', sanitizeForExcel(st.student_name), '', 'Aqoonsiga (ID):', sanitizeForExcel(st.student_code)]);
    sheet.addRow(['Fasalka:', sanitizeForExcel(classData.class_info.name), '', 'Sannadka:', academic_year]);
    sheet.addRow(['Kaalinta Fasalka (Rank):', `${st.rank} ee ${classData.total_students} arday`, '', 'Xaaladda:', st.result_status]);
    sheet.addRow([]);

    // Headers
    const headers = ['Koodhka', 'Maaddada', 'Dhibcaha Ugu Badan', 'Dhibcaha La Helay', 'Boqolkiiba (%)'];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };

    if (classData.is_configured_result) {
      (classData.distinct_subjects || []).forEach(subject => {
        const result = st.subject_results?.[subject.id];
        const obtained = result?.combined_total ?? '-';
        const percentage = obtained !== '-' ? `${((obtained / subject.maximum_marks) * 100).toFixed(1)}%` : '-';
        sheet.addRow([sanitizeForExcel(subject.code), sanitizeForExcel(subject.name), subject.maximum_marks, obtained, percentage]);
      });
    } else classData.exams.forEach(ex => {
      const sm = st.subject_marks[ex.exam_id];
      const max = parseFloat(ex.maximum_marks);
      const obt = sm && sm.status === 'present' ? sm.obtained : (sm && sm.status === 'absent' ? 'ABS' : '-');
      const pct = sm && sm.status === 'present' ? `${((sm.obtained / max) * 100).toFixed(1)}%` : '-';

      sheet.addRow([
        sanitizeForExcel(ex.subject_code),
        sanitizeForExcel(ex.subject_name),
        max,
        obt,
        pct
      ]);
    });

    const totalRow = sheet.addRow(['WADAR GUUD', '', classData.maximum_total, st.total_obtained, `${st.average_percentage}%`]);
    totalRow.font = { bold: true };

    sheet.columns = [
      { width: 16 }, { width: 30 }, { width: 22 }, { width: 20 }, { width: 18 }
    ];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=natiijada-${st.student_code}-${academic_year}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 8. CONFIGURABLE EXAM PERIODS
// ==========================================

export async function listExamSets(req, res, next) {
  try {
    const { academic_year = '2026', exam_set_id } = req.query;
    const examSet = await getConfiguredExamSetForYear(academic_year, exam_set_id);
    res.json({ success: true, data: examSet });
  } catch (error) {
    next(error);
  }
}

export async function saveExamSet(req, res, next) {
  try {
    const user = req.session.user;
    const {
      academic_year = '2026',
      name,
      description,
      members = []
    } = req.body;
    if (!name?.trim() || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ success: false, error: 'Magaca examination set-ka iyo ugu yaraan hal examination waa qasab.' });
    }

    const periodIds = members.map(member => Number(member.exam_period_id)).filter(Boolean);
    if (periodIds.length !== members.length || new Set(periodIds).size !== periodIds.length) {
      return res.status(400).json({ success: false, error: 'Examination kasta hal mar oo keliya ayuu set-ka ku jiri karaa.' });
    }
    const periods = await query(`
      SELECT id, name, academic_year FROM exam_periods
      WHERE academic_year = ? AND id IN (${periodIds.map(() => '?').join(',')})
    `, [academic_year, ...periodIds]);
    if (periods.length !== periodIds.length) {
      return res.status(400).json({ success: false, error: 'Examinations-ku waa inay ka wada tirsanaadaan isla academic year-ka.' });
    }

    const normalizedMembers = members.map((member, index) => {
      const maximumMarks = Number(member.maximum_marks);
      if (!Number.isFinite(maximumMarks) || maximumMarks <= 0) {
        throw Object.assign(new Error('Maximum marks waa inuu ka weyn yahay eber.'), { status: 400 });
      }
      return {
        exam_period_id: Number(member.exam_period_id),
        sequence_order: Number(member.sequence_order) || index + 1,
        maximum_marks: maximumMarks,
        is_required: member.is_required !== false
      };
    });

    let examSetId;
    await withTransaction(async (conn) => {
      const [existing] = await conn.execute(`SELECT id FROM institute_exam_sets WHERE academic_year = ? FOR UPDATE`, [academic_year]);
      if (existing.length > 0) {
        examSetId = existing[0].id;
        await conn.execute(`UPDATE institute_exam_sets SET name = ?, description = ?, status = 'configured', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [name.trim(), description?.trim() || null, examSetId]);
        await conn.execute(`DELETE FROM institute_exam_set_members WHERE exam_set_id = ?`, [examSetId]);
      } else {
        const [inserted] = await conn.execute(`INSERT INTO institute_exam_sets (name, academic_year, description, status, created_by) VALUES (?, ?, ?, 'configured', ?)`, [name.trim(), academic_year, description?.trim() || null, user.id]);
        examSetId = inserted.insertId;
      }

      for (const member of normalizedMembers) {
        await conn.execute(`
          INSERT INTO institute_exam_set_members (exam_set_id, exam_period_id, sequence_order, maximum_marks, is_required)
          VALUES (?, ?, ?, ?, ?)
        `, [examSetId, member.exam_period_id, member.sequence_order, member.maximum_marks, member.is_required ? 1 : 0]);
      }

      // Connect existing exam rows by their academic-year period title. This
      // never changes marks; it only adds the missing configuration link.
      await conn.execute(`
        UPDATE institute_exams e
        JOIN exam_periods ep ON BINARY ep.name = BINARY e.title AND BINARY ep.academic_year = BINARY e.academic_year
        JOIN institute_exam_set_members esm ON esm.exam_period_id = ep.id AND esm.exam_set_id = ?
        SET e.exam_set_id = ?, e.maximum_marks = esm.maximum_marks
        WHERE e.academic_year = ?
      `, [examSetId, examSetId, academic_year]);
    });

    await logAudit({
      userId: user.id,
      action: 'SAVE_CONNECTED_EXAM_SET',
      module: 'exams',
      division: 'institute',
      recordId: examSetId,
      details: { academic_year, name: name.trim(), member_count: normalizedMembers.length },
      ipAddress: req.ip
    });
    res.json({ success: true, id: examSetId, message: 'Connected examination set-ka si guul leh ayaa loo kaydiyay.' });
  } catch (error) {
    next(error);
  }
}

export async function listExamPeriods(req, res, next) {
  try {
    const { academic_year, status } = req.query;

    // Ensure Institute's official Arabic Two-Half examination periods exist
    await ensureOfficialExamPeriods(academic_year || '2026');

    let sql = `SELECT * FROM exam_periods WHERE 1=1`;
    const params = [];

    if (academic_year) {
      sql += ` AND academic_year = ?`;
      params.push(academic_year);
    }
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY sequence_order ASC, id ASC`;
    const periods = await query(sql, params);
    res.json({ success: true, data: periods });
  } catch (error) {
    next(error);
  }
}

export async function createExamPeriod(req, res, next) {
  try {
    const user = req.session.user;
    const {
      name,
      academic_year = '2026',
      exam_type = 'monthly',
      sequence_order = 1,
      max_contribution = 100.00,
      start_date,
      end_date,
      status = 'active',
      description = ''
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Magaca xilliga imtixaanka waa qasab.' });
    }

    const trimmedName = name.trim();

    const [dup] = await query(
      `SELECT id FROM exam_periods WHERE LOWER(TRIM(name)) = LOWER(?) AND academic_year = ?`,
      [trimmedName, academic_year]
    );
    if (dup) {
      return res.status(400).json({ success: false, error: `Xilliga imtixaanka '${trimmedName}' horey ayuu u jiraa sannadka ${academic_year}.` });
    }

    const result = await query(
      `INSERT INTO exam_periods (name, academic_year, exam_type, sequence_order, max_contribution, start_date, end_date, status, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trimmedName,
        academic_year,
        exam_type || 'monthly',
        parseInt(sequence_order, 10) || 1,
        parseFloat(max_contribution) || 100.00,
        start_date || null,
        end_date || null,
        status || 'active',
        description || null
      ]
    );

    // Create default fee rule if not exists
    await query(
      `INSERT IGNORE INTO exam_fee_rules (academic_year, exam_period, amount, description) VALUES (?, ?, 10.00, 'Lacagta Rasmiga ah')`,
      [academic_year, trimmedName]
    );

    await logAudit({
      userId: user.id,
      action: 'CREATE_EXAM_PERIOD',
      module: 'exams',
      division: 'institute',
      recordId: result.insertId,
      details: { name: trimmedName, academic_year, exam_type, max_contribution }
    });

    res.status(201).json({ success: true, message: 'Xilliga imtixaanka waa la abuuray.', id: result.insertId });
  } catch (error) {
    next(error);
  }
}

export async function updateExamPeriod(req, res, next) {
  try {
    const user = req.session.user;
    const { id } = req.params;
    const {
      name,
      academic_year = '2026',
      exam_type,
      sequence_order,
      max_contribution,
      start_date,
      end_date,
      status,
      description
    } = req.body;

    const [period] = await query(`SELECT * FROM exam_periods WHERE id = ?`, [id]);
    if (!period) {
      return res.status(404).json({ success: false, error: 'Xilliga imtixaanka lama helin.' });
    }

    const newName = name ? name.trim() : period.name;
    const newYear = academic_year || period.academic_year;
    const newStatus = status || period.status;
    const newType = exam_type || period.exam_type || 'monthly';
    const newSeq = sequence_order !== undefined ? parseInt(sequence_order, 10) : period.sequence_order;
    const newContribution = max_contribution !== undefined ? parseFloat(max_contribution) : period.max_contribution;
    const newDesc = description !== undefined ? description : period.description;

    if (newName !== period.name || newYear !== period.academic_year) {
      const [dup] = await query(
        `SELECT id FROM exam_periods WHERE LOWER(TRIM(name)) = LOWER(?) AND academic_year = ? AND id != ?`,
        [newName, newYear, id]
      );
      if (dup) {
        return res.status(400).json({ success: false, error: `Magacan horey ayaa loogu isticmaalay sannadka ${newYear}.` });
      }
    }

    await query(
      `UPDATE exam_periods 
       SET name = ?, academic_year = ?, exam_type = ?, sequence_order = ?, max_contribution = ?,
           start_date = ?, end_date = ?, status = ?, description = ?
       WHERE id = ?`,
      [
        newName,
        newYear,
        newType,
        newSeq,
        newContribution,
        start_date || null,
        end_date || null,
        newStatus,
        newDesc || null,
        id
      ]
    );

    await logAudit({
      userId: user.id,
      action: 'UPDATE_EXAM_PERIOD',
      module: 'exams',
      division: 'institute',
      recordId: id,
      details: { oldName: period.name, newName, status: newStatus }
    });

    res.json({ success: true, message: 'Xilliga imtixaanka waa la cusboonaysiiyay.' });
  } catch (error) {
    next(error);
  }
}

export async function deleteExamPeriod(req, res, next) {
  try {
    const user = req.session.user;
    const { id } = req.params;

    const [period] = await query(`SELECT * FROM exam_periods WHERE id = ?`, [id]);
    if (!period) {
      return res.status(404).json({ success: false, error: 'Xilliga imtixaanka lama helin.' });
    }

    // 1. Remove references in institute_exam_set_members
    await query(`DELETE FROM institute_exam_set_members WHERE exam_period_id = ?`, [id]);

    // 2. Remove timetable entries
    await query(`DELETE FROM exam_timetables WHERE exam_period_id = ?`, [id]);

    // 3. Remove fee rules
    await query(`DELETE FROM exam_fee_rules WHERE exam_period = ? AND academic_year = ?`, [period.name, period.academic_year]);

    // 4. Clean up any institute_exams and marks referencing this period name and year
    const examRows = await query(`SELECT id FROM institute_exams WHERE title = ? AND academic_year = ?`, [period.name, period.academic_year]);
    if (examRows.length > 0) {
      const examIds = examRows.map(e => e.id);
      await query(`DELETE FROM institute_exam_marks WHERE exam_id IN (?)`, [examIds]);
      await query(`DELETE FROM institute_exams WHERE id IN (?)`, [examIds]);
    }

    // 5. Delete the exam period
    await query(`DELETE FROM exam_periods WHERE id = ?`, [id]);

    await logAudit({
      userId: user.id,
      action: 'DELETE_EXAM_PERIOD',
      module: 'exams',
      division: 'institute',
      recordId: id,
      details: { name: period.name, academic_year: period.academic_year }
    });

    res.json({ success: true, message: `Imtixaanka '${period.name}' si guul leh ayaa loo tiray.` });
  } catch (error) {
    next(error);
  }
}

export async function deleteAllExamPeriods(req, res, next) {
  try {
    const user = req.session.user;
    const academic_year = req.body?.academic_year || req.query?.academic_year;

    if (!academic_year) {
      return res.status(400).json({ success: false, error: 'Sannad-dugsiyeedka (academic_year) waa qasab.' });
    }

    // 1. Remove set members and exam sets for this academic year
    await query(`DELETE FROM institute_exam_set_members WHERE exam_set_id IN (SELECT id FROM institute_exam_sets WHERE academic_year = ?)`, [academic_year]);
    await query(`DELETE FROM institute_exam_sets WHERE academic_year = ?`, [academic_year]);

    // 2. Remove timetables
    await query(`DELETE FROM exam_timetables WHERE academic_year = ? OR exam_period_id IN (SELECT id FROM exam_periods WHERE academic_year = ?)`, [academic_year, academic_year]);

    // 3. Remove fee rules
    await query(`DELETE FROM exam_fee_rules WHERE academic_year = ?`, [academic_year]);

    // 4. Remove marks and exams
    const examRows = await query(`SELECT id FROM institute_exams WHERE academic_year = ?`, [academic_year]);
    if (examRows.length > 0) {
      const examIds = examRows.map(e => e.id);
      await query(`DELETE FROM institute_exam_marks WHERE exam_id IN (?)`, [examIds]);
      await query(`DELETE FROM institute_exams WHERE id IN (?)`, [examIds]);
    }

    // 5. Delete all exam periods
    const delRes = await query(`DELETE FROM exam_periods WHERE academic_year = ?`, [academic_year]);

    await logAudit({
      userId: user.id,
      action: 'DELETE_ALL_EXAM_PERIODS',
      module: 'exams',
      division: 'institute',
      recordId: academic_year,
      details: `Deleted all exam periods for year ${academic_year} (${delRes.affectedRows} removed)`
    });

    res.json({
      success: true,
      message: `Dhammaan imtixaanaadka sannadka ${academic_year} si buuxda ayaa loo wada tiray (${delRes.affectedRows} imtixaan).`,
      count: delRes.affectedRows
    });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 9. UNIFIED CLASS-WIDE MARKS ENTRY
// ==========================================

export async function getUnifiedClassMarksSheet(req, res, next) {
  try {
    const { class_id, exam_period, academic_year = '2026' } = req.query;

    if (!class_id || !exam_period) {
      return res.status(400).json({
        success: false,
        error: 'Fasalka (class_id) iyo Xilliga Imtixaanka (exam_period) waa qasab.'
      });
    }

    const [cls] = await query(`SELECT * FROM institute_classes WHERE id = ?`, [class_id]);
    if (!cls) {
      return res.status(404).json({ success: false, error: 'Fasalka lama helin.' });
    }

    // 1. All active students enrolled in this class
    const students = await query(`
      SELECT s.id as student_id, s.student_id as student_code, s.full_name, s.gender
      FROM institute_enrollments ie
      JOIN students s ON ie.student_id = s.id
      WHERE ie.class_id = ? AND ie.status = 'active' AND s.is_active = 1
      ORDER BY s.full_name ASC
    `, [class_id]);

    // 2. All active subjects assigned to this class
    let subjects = await query(`
      SELECT s.id as subject_id, s.name as subject_name, s.code as subject_code
      FROM institute_class_subjects cs
      JOIN institute_subjects s ON cs.subject_id = s.id
      WHERE cs.class_id = ? AND s.is_active = 1
      ORDER BY s.name ASC
    `, [class_id]);

    if (subjects.length === 0) {
      subjects = await query(`
        SELECT id as subject_id, name as subject_name, code as subject_code
        FROM institute_subjects
        WHERE is_active = 1
        ORDER BY name ASC
      `);
    }

    // 3. For each subject, locate or prepare institute_exams entry
    const existingExams = await query(`
      SELECT e.id as exam_id, e.subject_id, e.maximum_marks, e.status, e.exam_date, e.exam_set_id
      FROM institute_exams e
      WHERE e.class_id = ? AND e.title = ? AND e.academic_year = ?
    `, [class_id, exam_period, academic_year]);

    const examMap = new Map();
    existingExams.forEach(ex => examMap.set(ex.subject_id, ex));

    const [period] = await query(
      `SELECT id, max_contribution FROM exam_periods WHERE TRIM(name) = TRIM(?) AND academic_year = ?`,
      [exam_period, academic_year]
    );
    const configured = period ? await getConfiguredMember({ exam_period_id: period.id, academic_year }) : { member: null, examSet: null };
    const officialMax = getOfficialExamMax(exam_period);
    const resolvedDefaultMax = configured.member?.maximum_marks
      || (period && period.max_contribution ? parseFloat(period.max_contribution) : null)
      || officialMax
      || 100.00;

    const enrichedSubjects = subjects.map(sub => {
      const ex = examMap.get(sub.subject_id);
      const subMax = configured.member?.maximum_marks
        || (ex && ex.maximum_marks ? parseFloat(ex.maximum_marks) : resolvedDefaultMax);

      return {
        id: sub.subject_id,
        subject_id: sub.subject_id,
        name: sub.subject_name,
        subject_name: sub.subject_name,
        code: sub.subject_code,
        subject_code: sub.subject_code,
        exam_id: ex ? ex.exam_id : null,
        exam_set_id: configured.examSet?.id || ex?.exam_set_id || null,
        maximum_marks: subMax,
        status: ex ? ex.status : 'draft',
        exam_date: ex ? ex.exam_date : null
      };
    });

    // 4. Load all existing marks across these subjects
    const marksRows = await query(`
      SELECT m.student_id, m.marks_obtained, m.is_absent, m.percentage, m.grade, m.notes, e.subject_id
      FROM institute_exam_marks m
      JOIN institute_exams e ON m.exam_id = e.id
      WHERE e.class_id = ? AND e.title = ? AND e.academic_year = ?
    `, [class_id, exam_period, academic_year]);

    const studentMarksMap = new Map();
    marksRows.forEach(row => {
      if (!studentMarksMap.has(row.student_id)) {
        studentMarksMap.set(row.student_id, {});
      }
      studentMarksMap.get(row.student_id)[row.subject_id] = {
        marks_obtained: row.marks_obtained !== null && row.marks_obtained !== undefined ? parseFloat(row.marks_obtained) : '',
        is_absent: Boolean(row.is_absent),
        percentage: row.percentage !== null ? parseFloat(row.percentage) : null,
        grade: row.grade,
        notes: row.notes || ''
      };
    });

    // 5. Structure student rows with marks matrix
    const rows = students.map(st => {
      const marksObj = studentMarksMap.get(st.student_id) || {};
      const subjectMarks = {};
      let totalObtained = 0;
      let maxPossible = 0;
      let hasAnyMarks = false;

      enrichedSubjects.forEach(sub => {
        const sm = marksObj[sub.subject_id];
        if (sm) {
          subjectMarks[sub.subject_id] = sm;
          subjectMarks[sub.id] = sm;
          if (!sm.is_absent && sm.marks_obtained !== '') {
            totalObtained += parseFloat(sm.marks_obtained);
            maxPossible += sub.maximum_marks;
            hasAnyMarks = true;
          }
        } else {
          const emptyMark = {
            marks_obtained: '',
            is_absent: false,
            percentage: null,
            grade: null,
            notes: ''
          };
          subjectMarks[sub.subject_id] = emptyMark;
          subjectMarks[sub.id] = emptyMark;
        }
      });

      return {
        id: st.student_id,
        ...st,
        marks: subjectMarks,
        total_obtained: hasAnyMarks ? Number(totalObtained.toFixed(2)) : null,
        max_possible: hasAnyMarks ? maxPossible : 0,
        average_percentage: hasAnyMarks && maxPossible > 0 ? Number(((totalObtained / maxPossible) * 100).toFixed(1)) : null
      };
    });

    res.json({
      success: true,
      data: {
        class: cls,
        class_info: cls,
        exam_period,
        academic_year,
        subjects: enrichedSubjects,
        students: rows,
        exam_set_id: configured.examSet?.id || null
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function saveUnifiedClassMarks(req, res, next) {
  try {
    const user = req.session.user;
    let {
      class_id,
      exam_period,
      academic_year = '2026',
      exam_date,
      status = 'marks_entry',
      subjects_config = [],
      rows = [],
      marks_grid = []
    } = req.body;

    // Normalize rows if marks_grid is provided
    if ((!rows || rows.length === 0) && Array.isArray(marks_grid) && marks_grid.length > 0) {
      const studentMap = new Map();
      for (const item of marks_grid) {
        if (!studentMap.has(item.student_id)) {
          studentMap.set(item.student_id, { student_id: item.student_id, marks: {} });
        }
        studentMap.get(item.student_id).marks[item.subject_id] = {
          marks_obtained: item.marks_obtained,
          is_absent: Boolean(item.is_absent)
        };
      }
      rows = Array.from(studentMap.values());
    }

    if (!class_id || !exam_period || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Xogta imtixaanka ama ardayda ma dhammaystirna.'
      });
    }

    const [cls] = await query(`SELECT * FROM institute_classes WHERE id = ?`, [class_id]);
    if (!cls) {
      return res.status(404).json({ success: false, error: 'Fasalka lama helin.' });
    }

    const [period] = await query(
      `SELECT id, max_contribution FROM exam_periods WHERE TRIM(name) = TRIM(?) AND academic_year = ?`,
      [exam_period, academic_year]
    );
    const configured = period ? await getConfiguredMember({ exam_period_id: period.id, academic_year }) : { member: null, examSet: null };
    const officialMax = getOfficialExamMax(exam_period);
    const resolvedDefaultMax = configured.member?.maximum_marks
      || (period && period.max_contribution ? parseFloat(period.max_contribution) : null)
      || officialMax
      || 100.00;

    // Auto-detect subjects_config if not explicitly provided
    if (!Array.isArray(subjects_config) || subjects_config.length === 0) {
      const subRows = await query(`
        SELECT s.id as subject_id FROM institute_class_subjects cs
        JOIN institute_subjects s ON cs.subject_id = s.id
        WHERE cs.class_id = ? AND s.is_active = 1
      `, [class_id]);

      let selectedSubs = subRows;
      if (selectedSubs.length === 0) {
        selectedSubs = await query(`SELECT id as subject_id FROM institute_subjects WHERE is_active = 1`);
      }
      subjects_config = selectedSubs.map(s => ({ subject_id: s.subject_id, maximum_marks: resolvedDefaultMax }));
    }

    let savedCount = 0;

    await withTransaction(async (conn) => {
      // 1. Ensure institute_exams record exists for each configured subject
      const subjectExamMap = new Map();
      const actualExamDate = exam_date || new Date().toISOString().slice(0, 10);

      for (const subConf of subjects_config) {
        const subId = subConf.subject_id;
        const maxMarks = configured.member?.maximum_marks
          || (subConf.maximum_marks ? parseFloat(subConf.maximum_marks) : resolvedDefaultMax);

        if (maxMarks <= 0) {
          throw new Error(`Dhibcaha ugu badan ee maaddada (${subId}) waa inay ka weynaadaan 0.`);
        }

        const [existing] = await conn.execute(
          `SELECT id, status FROM institute_exams 
           WHERE class_id = ? AND subject_id = ? AND title = ? AND academic_year = ?`,
          [class_id, subId, exam_period, academic_year]
        );

        let examId;
        if (existing && existing.length > 0) {
          examId = existing[0].id;
          await conn.execute(
            `UPDATE institute_exams 
             SET maximum_marks = ?, exam_set_id = ?, status = ?, exam_date = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [maxMarks, configured.examSet?.id || null, status, actualExamDate, examId]
          );
        } else {
          const [ins] = await conn.execute(
            `INSERT INTO institute_exams (title, academic_year, exam_set_id, class_id, subject_id, exam_date, maximum_marks, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [exam_period, academic_year, configured.examSet?.id || null, class_id, subId, actualExamDate, maxMarks, status, user.id]
          );
          examId = ins.insertId;
        }

        subjectExamMap.set(subId, { examId, maxMarks });
      }

      // 2. Upsert marks for each student row and subject
      for (const row of rows) {
        const studentId = row.student_id;
        const marksObj = row.marks || {};

        for (const [subIdStr, markItem] of Object.entries(marksObj)) {
          const subId = parseInt(subIdStr, 10);
          const examMeta = subjectExamMap.get(subId);
          if (!examMeta) continue;

          const isAbsent = Boolean(markItem.is_absent);
          let obtained = null;
          let percentage = null;
          let grade = null;

          if (isAbsent) {
            grade = 'ABS';
          } else if (markItem.marks_obtained !== null && markItem.marks_obtained !== undefined && markItem.marks_obtained !== '') {
            obtained = parseFloat(markItem.marks_obtained);
            if (isNaN(obtained) || obtained < 0 || obtained > examMeta.maxMarks) {
              throw new Error(`Dhibcaha ardayga ID ${studentId} ma dhaafi karaan ugu badnaan ${examMeta.maxMarks} dhibcood imtixaanka '${exam_period}'.`);
            }
            percentage = Number(((obtained / examMeta.maxMarks) * 100).toFixed(2));
            if (percentage >= 90) grade = 'A+';
            else if (percentage >= 80) grade = 'A';
            else if (percentage >= 70) grade = 'B';
            else if (percentage >= 60) grade = 'C';
            else if (percentage >= 50) grade = 'D';
            else grade = 'F';
          }

          if (isAbsent || obtained !== null) {
            await conn.execute(
              `INSERT INTO institute_exam_marks (exam_id, student_id, marks_obtained, is_absent, percentage, grade, notes, entered_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE 
                 marks_obtained = VALUES(marks_obtained),
                 is_absent = VALUES(is_absent),
                 percentage = VALUES(percentage),
                 grade = VALUES(grade),
                 notes = VALUES(notes),
                 entered_by = VALUES(entered_by)`,
              [examMeta.examId, studentId, obtained, isAbsent, percentage, grade, markItem.notes || null, user.id]
            );
          } else {
            await conn.execute(
              `DELETE FROM institute_exam_marks WHERE exam_id = ? AND student_id = ?`,
              [examMeta.examId, studentId]
            );
          }
        }
      }
    });

    await logAudit({
      userId: user.id,
      action: 'SAVE_UNIFIED_CLASS_MARKS',
      module: 'exams',
      division: 'institute',
      recordId: class_id,
      details: { exam_period, academic_year, studentsCount: rows.length }
    });

    res.json({
      success: true,
      message: `Dhibcaha dhammaan maaddooyinka ee fasalka '${cls.name}' xilliga '${exam_period}' si guul leh ayaa loo kaydiyay.`
    });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 10. EXAM FEE MANAGEMENT (رسوم الامتحان)
// ==========================================

export async function getExamFeeRules(req, res, next) {
  try {
    const { academic_year = '2026', exam_period } = req.query;
    let sql = `SELECT * FROM exam_fee_rules WHERE academic_year = ?`;
    const params = [academic_year];

    if (exam_period) {
      sql += ` AND exam_period = ?`;
      params.push(exam_period);
    }

    const rules = await query(sql, params);
    res.json({ success: true, data: rules });
  } catch (error) {
    next(error);
  }
}

export async function setExamFeeRule(req, res, next) {
  try {
    const user = req.session.user;
    const { academic_year = '2026', exam_period, class_id = null, amount, description } = req.body;

    if (!exam_period || amount === undefined || amount === null) {
      return res.status(400).json({ success: false, error: 'Xilliga imtixaanka iyo qadarka lacagta waa qasab.' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ success: false, error: 'Qadarka lacagta waa inuu noqdaa 0 ama ka weyn.' });
    }

    await query(
      `INSERT INTO exam_fee_rules (academic_year, exam_period, class_id, amount, description)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE amount = VALUES(amount), description = VALUES(description)`,
      [academic_year, exam_period, class_id, numAmount, description || '']
    );

    await logAudit({
      userId: user.id,
      action: 'SET_EXAM_FEE_RULE',
      module: 'exams',
      division: 'institute',
      recordId: null,
      details: { academic_year, exam_period, amount: numAmount }
    });

    res.json({ success: true, message: 'Qaanuunka lacagta imtixaanka waa la xaqiijiyay.' });
  } catch (error) {
    next(error);
  }
}

export async function getStudentExamFeeStatus(req, res, next) {
  try {
    const { student_id, exam_period, academic_year = '2026' } = req.query;

    if (!student_id || !exam_period) {
      return res.status(400).json({ success: false, error: 'student_id iyo exam_period waa qasab.' });
    }

    const [student] = await query(`
      SELECT s.id as student_id, s.student_id as student_code, s.full_name, s.phone,
             c.id as class_id, c.name as class_name
      FROM students s
      LEFT JOIN institute_enrollments ie ON s.id = ie.student_id AND ie.status = 'active'
      LEFT JOIN institute_classes c ON ie.class_id = c.id
      WHERE s.id = ?
      LIMIT 1
    `, [student_id]);

    if (!student) {
      return res.status(404).json({ success: false, error: 'Ardayga lama helin.' });
    }

    let feeRule = null;
    if (student.class_id) {
      const [classSpecific] = await query(
        `SELECT amount FROM exam_fee_rules WHERE academic_year = ? AND exam_period = ? AND class_id = ?`,
        [academic_year, exam_period, student.class_id]
      );
      if (classSpecific) feeRule = classSpecific;
    }

    if (!feeRule) {
      const [generalRule] = await query(
        `SELECT amount FROM exam_fee_rules WHERE academic_year = ? AND exam_period = ? AND class_id IS NULL`,
        [academic_year, exam_period]
      );
      feeRule = generalRule;
    }

    const officialFee = feeRule ? parseFloat(feeRule.amount) : 10.00;

    const [paidRow] = await query(`
      SELECT COALESCE(SUM(amount_paid), 0) as total_paid
      FROM exam_fee_payments
      WHERE student_id = ? AND exam_period = ? AND academic_year = ? AND status = 'valid'
    `, [student_id, exam_period, academic_year]);

    const totalPaid = parseFloat(paidRow.total_paid || 0);
    const balanceRemaining = Math.max(0, Number((officialFee - totalPaid).toFixed(2)));

    res.json({
      success: true,
      data: {
        student,
        exam_period,
        academic_year,
        official_fee: officialFee,
        amount_paid: totalPaid,
        previously_paid: totalPaid,
        balance_remaining: balanceRemaining,
        remaining_balance: balanceRemaining
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function recordExamFeePayment(req, res, next) {
  try {
    const user = req.session.user;
    const {
      student_id,
      exam_period,
      academic_year = '2026',
      payment_date,
      notes = ''
    } = req.body;

    const rawAmount = req.body.amount_paid !== undefined ? req.body.amount_paid : req.body.amount;

    if (!student_id || !exam_period || rawAmount === undefined) {
      return res.status(400).json({ success: false, error: 'student_id, exam_period, iyo amount_paid waa qasab.' });
    }

    const paymentAmount = parseFloat(rawAmount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Lacagta la bixinayo waa inay ka weynaataa 0.' });
    }

    const [student] = await query(`
      SELECT s.id, s.student_id as student_code, s.full_name, c.id as class_id, c.name as class_name
      FROM students s
      LEFT JOIN institute_enrollments ie ON s.id = ie.student_id AND ie.status = 'active'
      LEFT JOIN institute_classes c ON ie.class_id = c.id
      WHERE s.id = ?
    `, [student_id]);

    if (!student) {
      return res.status(404).json({ success: false, error: 'Ardayga lama helin.' });
    }

    const [rule] = await query(
      `SELECT amount FROM exam_fee_rules WHERE academic_year = ? AND exam_period = ? ORDER BY class_id DESC LIMIT 1`,
      [academic_year, exam_period]
    );
    const officialFee = rule ? parseFloat(rule.amount) : 10.00;

    const [prev] = await query(
      `SELECT COALESCE(SUM(amount_paid), 0) as paid FROM exam_fee_payments 
       WHERE student_id = ? AND exam_period = ? AND academic_year = ? AND status = 'valid'`,
      [student_id, exam_period, academic_year]
    );
    const prevPaid = parseFloat(prev.paid || 0);
    const currentBalance = Math.max(0, officialFee - prevPaid);

    if (currentBalance <= 0) {
      return res.status(400).json({
        success: false,
        error: `Ardaygan horay ayuu u bixiyay dhammaan lacagtii imtixaanka ee xilliga '${exam_period}'.`
      });
    }

    if (paymentAmount > currentBalance + 0.001) {
      return res.status(400).json({
        success: false,
        error: `Lacagta la gelinayo ($${paymentAmount}) way ka badan tahay haraaga dhiman ($${currentBalance}).`
      });
    }

    // Duplicate submission prevention (15 second window for exact same student, period, amount)
    const [dupRecent] = await query(
      `SELECT id, receipt_number FROM exam_fee_payments 
       WHERE student_id = ? AND exam_period = ? AND amount_paid = ? AND status = 'valid' 
         AND created_at >= NOW() - INTERVAL 15 SECOND`,
      [student_id, exam_period, paymentAmount]
    );
    if (dupRecent) {
      return res.status(400).json({
        success: false,
        error: `Bixintaan mar hore ayaa la qabtay (Rasiid: ${dupRecent.receipt_number}). Fadlan ha laban-laabin gujinta.`
      });
    }

    const newBalance = Math.max(0, Number((currentBalance - paymentAmount).toFixed(2)));
    const actualPayDate = payment_date || new Date().toISOString().slice(0, 10);

    let savedPaymentId;
    let receiptNumber;

    await withTransaction(async (conn) => {
      const [cntRow] = await conn.execute(
        `SELECT COUNT(*) as total_payments FROM exam_fee_payments WHERE academic_year = ? FOR UPDATE`,
        [academic_year]
      );
      const nextSeq = Number(cntRow[0].total_payments || 0) + 1;
      receiptNumber = `EX-${academic_year}-${String(nextSeq).padStart(4, '0')}`;

      const [insResult] = await conn.execute(
        `INSERT INTO exam_fee_payments 
         (receipt_number, academic_year, exam_period, student_id, class_id, fee_amount, amount_paid, balance_remaining, payment_date, status, received_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'valid', ?, ?)`,
        [receiptNumber, academic_year, exam_period, student.id, student.class_id || null, officialFee, paymentAmount, newBalance, actualPayDate, user.id, notes || null]
      );
      savedPaymentId = insResult.insertId;
    });

    await logAudit({
      userId: user.id,
      action: 'RECORD_EXAM_FEE',
      module: 'exams',
      division: 'institute',
      recordId: savedPaymentId,
      details: { receiptNumber, studentId: student.id, exam_period, amount: paymentAmount, balance: newBalance }
    });

    res.status(201).json({
      success: true,
      message: 'Lacagta imtixaanka si guul leh ayaa loo qabtay.',
      data: {
        id: savedPaymentId,
        receipt_number: receiptNumber,
        academic_year,
        exam_period,
        student_name: student.full_name,
        student_code: student.student_code,
        class_name: student.class_name || 'Fasal la\'aan',
        fee_amount: officialFee,
        amount_paid: paymentAmount,
        balance_remaining: newBalance,
        payment_date: actualPayDate,
        created_at: new Date().toISOString(),
        received_by_name: user.full_name || user.username,
        notes: notes || ''
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getExamFeeHistory(req, res, next) {
  try {
    const { academic_year, exam_period, class_id, search, limit = 50 } = req.query;

    let sql = `
      SELECT p.*, s.full_name as student_name, s.student_id as student_code,
             c.name as class_name, u.full_name as received_by_name
      FROM exam_fee_payments p
      JOIN students s ON p.student_id = s.id
      LEFT JOIN institute_classes c ON p.class_id = c.id
      LEFT JOIN users u ON p.received_by = u.id
      WHERE p.status = 'valid'
    `;
    const params = [];

    if (academic_year) {
      sql += ` AND p.academic_year = ?`;
      params.push(academic_year);
    }
    if (exam_period && exam_period !== 'all') {
      sql += ` AND p.exam_period = ?`;
      params.push(exam_period);
    }
    if (class_id) {
      sql += ` AND p.class_id = ?`;
      params.push(class_id);
    }
    if (search) {
      sql += ` AND (p.receipt_number LIKE ? OR s.full_name LIKE ? OR s.student_id LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    sql += ` ORDER BY p.id DESC LIMIT ?`;
    params.push(parseInt(limit, 10) || 50);

    const history = await query(sql, params);
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
}

export async function getExamFeeReceipt(req, res, next) {
  try {
    const { id } = req.params;

    const [payment] = await query(`
      SELECT p.*, s.full_name as student_name, s.student_id as student_code,
             c.name as class_name, u.full_name as received_by_name
      FROM exam_fee_payments p
      JOIN students s ON p.student_id = s.id
      LEFT JOIN institute_classes c ON p.class_id = c.id
      LEFT JOIN users u ON p.received_by = u.id
      WHERE (p.id = ? OR p.receipt_number = ?)
      LIMIT 1
    `, [id, id]);

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Rasiidka lama helin.' });
    }

    payment.institute_name = 'معهد التفسير للعلوم الشرعية والعربية';

    res.json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 10. ASSESSMENT SCHEME & ANNUAL EXAM PLAN
// ==========================================

export async function getAssessmentConfig(req, res, next) {
  try {
    const { academic_year = '2026' } = req.query;
    let [config] = await query(
      `SELECT * FROM academic_year_assessment_configs WHERE academic_year = ?`,
      [academic_year]
    );

    if (!config) {
      config = {
        academic_year,
        marking_mode: 'mode_b',
        mode_b_calculation: 'average',
        pass_threshold: 50.00,
        description: ''
      };
    }

    const periods = await query(
      `SELECT id, name, academic_year, exam_type, sequence_order, max_contribution, status, description
       FROM exam_periods
       WHERE academic_year = ?
       ORDER BY sequence_order ASC, id ASC`,
      [academic_year]
    );

    res.json({ success: true, data: { config, periods } });
  } catch (error) {
    next(error);
  }
}

export async function saveAssessmentConfig(req, res, next) {
  try {
    const user = req.session.user;
    const {
      academic_year = '2026',
      marking_mode = 'mode_b',
      mode_b_calculation = 'average',
      pass_threshold = 50.00,
      description = ''
    } = req.body;

    if (!['mode_a', 'mode_b'].includes(marking_mode)) {
      return res.status(400).json({ success: false, error: 'Habka dhibcaha waa inuu noqdaa Mode A ama Mode B.' });
    }
    if (!['average', 'final_only'].includes(mode_b_calculation)) {
      return res.status(400).json({ success: false, error: 'Xisaabinta Mode B waa inay noqotaa Celcelis (average) ama Final Only.' });
    }
    const threshold = parseFloat(pass_threshold);
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      return res.status(400).json({ success: false, error: 'Xadka baaska waa inuu u dhexeeyaa 0 iyo 100.' });
    }

    await query(`
      INSERT INTO academic_year_assessment_configs 
        (academic_year, marking_mode, mode_b_calculation, pass_threshold, description)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        marking_mode = VALUES(marking_mode),
        mode_b_calculation = VALUES(mode_b_calculation),
        pass_threshold = VALUES(pass_threshold),
        description = VALUES(description),
        updated_at = CURRENT_TIMESTAMP
    `, [academic_year, marking_mode, mode_b_calculation, threshold, description || null]);

    await logAudit({
      userId: user.id,
      action: 'UPDATE_ASSESSMENT_CONFIG',
      module: 'exams',
      division: 'institute',
      recordId: academic_year,
      details: `Updated assessment config for ${academic_year}: mode=${marking_mode}, threshold=${threshold}%`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Habka qiimaynta dhibcaha sannadka waa la kaydiyay.' });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 11. EXAMINATION TIMETABLES
// ==========================================

export async function getClassExamTimetable(req, res, next) {
  try {
    const { class_id, exam_period_id, exam_period, academic_year } = req.query;
    const periodParam = exam_period_id || exam_period;

    if (!class_id || !periodParam) {
      return res.status(400).json({ success: false, error: 'class_id iyo exam_period waa qasab.' });
    }

    const [cls] = await query(`SELECT * FROM institute_classes WHERE id = ?`, [class_id]);
    if (!cls) {
      return res.status(404).json({ success: false, error: 'Fasalka lama helin.' });
    }

    let [period] = await query(
      `SELECT * FROM exam_periods WHERE id = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?)) ORDER BY id DESC LIMIT 1`,
      [periodParam, periodParam]
    );

    if (!period) {
      const [likePeriod] = await query(
        `SELECT * FROM exam_periods WHERE LOWER(TRIM(name)) LIKE LOWER(TRIM(?)) ORDER BY id DESC LIMIT 1`,
        [`%${periodParam}%`]
      );
      period = likePeriod;
    }

    if (!period) {
      return res.status(404).json({ success: false, error: `Xilliga imtixaanka '${periodParam}' lama helin.` });
    }

    // Only subjects assigned to this class!
    const assignedSubjects = await query(`
      SELECT s.id, s.name, s.code
      FROM institute_class_subjects ics
      JOIN institute_subjects s ON ics.subject_id = s.id
      WHERE ics.class_id = ? AND s.is_active = 1
      ORDER BY s.name ASC
    `, [class_id]);

    const entries = await query(`
      SELECT et.id, et.academic_year, et.exam_period_id, et.class_id, et.subject_id,
             DATE_FORMAT(et.exam_date, '%Y-%m-%d') as exam_date,
             et.day_of_week,
             TIME_FORMAT(et.start_time, '%H:%i') as start_time,
             TIME_FORMAT(et.end_time, '%H:%i') as end_time,
             et.notes,
             s.name as subject_name, s.code as subject_code
      FROM exam_timetables et
      JOIN institute_subjects s ON et.subject_id = s.id
      WHERE et.class_id = ? AND et.exam_period_id = ?
      ORDER BY et.exam_date ASC, et.start_time ASC
    `, [class_id, period.id]);

    res.json({
      success: true,
      data: {
        class_info: cls,
        exam_period: period,
        academic_year: academic_year || cls.academic_year || period.academic_year || '2026',
        assigned_subjects: assignedSubjects,
        entries
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function saveClassExamTimetable(req, res, next) {
  try {
    const user = req.session.user;
    const {
      class_id,
      exam_period_id,
      exam_period,
      academic_year = '2026',
      entries,
      subject_id,
      exam_date,
      day_of_week,
      start_time,
      end_time,
      notes
    } = req.body;

    const periodParam = exam_period_id || exam_period;

    if (!class_id || !periodParam) {
      return res.status(400).json({ success: false, error: 'Xogta jadwalka ma dhammaystirna: class_id iyo exam_period waa qasab.' });
    }

    const [cls] = await query(`SELECT * FROM institute_classes WHERE id = ?`, [class_id]);
    if (!cls) {
      return res.status(404).json({ success: false, error: 'Fasalka lama helin.' });
    }

    let [period] = await query(
      `SELECT * FROM exam_periods WHERE id = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?)) ORDER BY id DESC LIMIT 1`,
      [periodParam, periodParam]
    );

    if (!period) {
      const [likePeriod] = await query(
        `SELECT * FROM exam_periods WHERE LOWER(TRIM(name)) LIKE LOWER(TRIM(?)) ORDER BY id DESC LIMIT 1`,
        [`%${periodParam}%`]
      );
      period = likePeriod;
    }

    if (!period) {
      return res.status(404).json({ success: false, error: `Xilliga imtixaanka '${periodParam}' lama helin.` });
    }

    // Determine entries list: either full array or single entry payload
    const isSingleEntry = !Array.isArray(entries) && subject_id;
    const entriesToSave = Array.isArray(entries)
      ? entries
      : (isSingleEntry ? [{ subject_id, exam_date, day_of_week, start_time, end_time, notes }] : []);

    if (entriesToSave.length === 0) {
      return res.status(400).json({ success: false, error: 'Fadlan geli xogta ugu yaraan hal maaddo oo jadwalka ah.' });
    }

    // Verify all subjects belong to this class
    const assigned = await query(`
      SELECT subject_id FROM institute_class_subjects WHERE class_id = ?
    `, [class_id]);
    const assignedIds = new Set(assigned.map(a => a.subject_id));

    for (const ent of entriesToSave) {
      if (!assignedIds.has(parseInt(ent.subject_id, 10))) {
        return res.status(400).json({
          success: false,
          error: `Maaddada ID ${ent.subject_id} looma xilsaarin fasalka '${cls.name}'. Dooro kaliya maaddooyinka fasalka u xilsaaran.`
        });
      }
      if (!ent.exam_date || !ent.day_of_week || !ent.start_time || !ent.end_time) {
        return res.status(400).json({
          success: false,
          error: 'Taariikhda, maalinta, waqtiga bilowga iyo dhammaadka waa qasab xariiq kasta.'
        });
      }
      if (ent.start_time >= ent.end_time) {
        return res.status(400).json({
          success: false,
          error: `Waqtiga dhammaadka (${ent.end_time}) waa inuu ka dambeeyaa waqtiga bilowga (${ent.start_time}).`
        });
      }
    }

    await withTransaction(async (conn) => {
      if (Array.isArray(entries)) {
        // Full replacement requested
        await conn.execute(`
          DELETE FROM exam_timetables WHERE class_id = ? AND exam_period_id = ?
        `, [class_id, period.id]);
      } else if (isSingleEntry) {
        // Single entry: remove any conflicting entry for this same subject in this exam period
        await conn.execute(`
          DELETE FROM exam_timetables WHERE class_id = ? AND exam_period_id = ? AND subject_id = ?
        `, [class_id, period.id, parseInt(subject_id, 10)]);
      }

      // Insert new entries
      for (const ent of entriesToSave) {
        await conn.execute(`
          INSERT INTO exam_timetables 
            (academic_year, exam_period_id, class_id, subject_id, exam_date, day_of_week, start_time, end_time, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          academic_year || cls.academic_year || period.academic_year || '2026',
          period.id,
          class_id,
          parseInt(ent.subject_id, 10),
          ent.exam_date,
          ent.day_of_week,
          ent.start_time,
          ent.end_time,
          ent.notes || null,
          user.id
        ]);
      }
    });

    await logAudit({
      userId: user.id,
      action: 'SAVE_EXAM_TIMETABLE',
      module: 'exams',
      division: 'institute',
      recordId: `${class_id}_${period.id}`,
      details: `Saved timetable for class ${cls.name}, exam ${period.name} (${entriesToSave.length} entries)`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Jadwalka imtixaanka si guul leh ayaa loo kaydiyay.' });
  } catch (error) {
    next(error);
  }
}

export async function deleteClassExamTimetableEntry(req, res, next) {
  try {
    const user = req.session.user;
    const { id } = req.params;

    const [entry] = await query(`SELECT * FROM exam_timetables WHERE id = ?`, [id]);
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Xogta jadwalka lama helin.' });
    }

    await query(`DELETE FROM exam_timetables WHERE id = ?`, [id]);

    await logAudit({
      userId: user.id,
      action: 'DELETE_EXAM_TIMETABLE_ENTRY',
      module: 'exams',
      division: 'institute',
      recordId: id,
      details: `Deleted timetable entry ${id}`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Xogta jadwalka waa la tiray.' });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 12. AUTOMATIC SINGLE MARK SAVING
// ==========================================

export async function saveSingleMark(req, res, next) {
  try {
    const user = req.session.user;
    const {
      class_id,
      exam_period,
      subject_id,
      student_id,
      academic_year = '2026',
      marks_obtained,
      is_absent = false,
      notes = null
    } = req.body;

    if (!class_id || !exam_period || !subject_id || !student_id) {
      return res.status(400).json({ success: false, error: 'Xogta dhibicda ma dhammaystirna.' });
    }

    // 1. Verify subject is assigned to class
    const [subAssign] = await query(
      `SELECT 1 FROM institute_class_subjects WHERE class_id = ? AND subject_id = ?`,
      [class_id, subject_id]
    );
    if (!subAssign) {
      return res.status(400).json({ success: false, error: 'Maaddadan looma xilsaarin fasalkan.' });
    }

    // 2. Verify student is enrolled in class
    const [enrollment] = await query(
      `SELECT 1 FROM institute_enrollments WHERE class_id = ? AND student_id = ? AND status = 'active'`,
      [class_id, student_id]
    );
    if (!enrollment) {
      return res.status(400).json({ success: false, error: 'Ardaygan kuma qorna fasalkan.' });
    }

    // 3. Locate or create institute_exams entry
    let [exam] = await query(
      `SELECT id, maximum_marks, exam_set_id FROM institute_exams 
       WHERE class_id = ? AND subject_id = ? AND title = ? AND academic_year = ?`,
      [class_id, subject_id, exam_period, academic_year]
    );

    const [period] = await query(
      `SELECT id, max_contribution FROM exam_periods WHERE TRIM(name) = TRIM(?) AND academic_year = ?`,
      [exam_period, academic_year]
    );

    const configured = period
      ? await getConfiguredMember({ exam_period_id: period.id, academic_year })
      : await getConfiguredMember({ exam_period: exam_period, academic_year });

    const [assessmentConfig] = await query(
      `SELECT marking_mode FROM academic_year_assessment_configs WHERE academic_year = ?`,
      [academic_year]
    );

    let maxMarks = 100.00;
    if (configured.member && configured.member.maximum_marks) {
      maxMarks = parseFloat(configured.member.maximum_marks);
    } else if (period && period.max_contribution) {
      maxMarks = parseFloat(period.max_contribution);
    } else if (exam && exam.maximum_marks) {
      maxMarks = parseFloat(exam.maximum_marks);
    } else if (!period) {
      const officialMax = getOfficialExamMax(exam_period);
      if (officialMax !== null) maxMarks = officialMax;
    } else if (assessmentConfig && assessmentConfig.marking_mode === 'mode_b') {
      maxMarks = 100.00;
    }

    let examId;
    if (exam) {
      examId = exam.id;
      if (parseFloat(exam.maximum_marks) !== maxMarks || (exam.exam_set_id || null) !== (configured.examSet?.id || null)) {
        await query(`UPDATE institute_exams SET maximum_marks = ?, exam_set_id = ? WHERE id = ?`, [maxMarks, configured.examSet?.id || null, examId]);
      }
    } else {
      const ins = await query(
        `INSERT INTO institute_exams (title, academic_year, class_id, subject_id, exam_date, maximum_marks, status, created_by, exam_set_id)
         VALUES (?, ?, ?, ?, CURDATE(), ?, 'marks_entry', ?, ?)`,
        [exam_period, academic_year, class_id, subject_id, maxMarks, user.id, configured.examSet?.id || null]
      );
      examId = ins.insertId;
    }

    // 4. Validate marks bounds
    const absent = Boolean(is_absent);
    let obtained = null;
    let percentage = null;
    let grade = null;

    if (absent) {
      grade = 'ABS';
    } else if (marks_obtained !== null && marks_obtained !== undefined && marks_obtained !== '') {
      obtained = parseFloat(marks_obtained);
      if (isNaN(obtained) || obtained < 0 || obtained > maxMarks) {
        return res.status(400).json({
          success: false,
          error: `Dhibcuhu ma dhaafi karaan ugu badnaan ${maxMarks} dhibcood imtixaanka '${exam_period}'.`
        });
      }
      percentage = Number(((obtained / maxMarks) * 100).toFixed(2));
      if (percentage >= 90) grade = 'A+';
      else if (percentage >= 80) grade = 'A';
      else if (percentage >= 70) grade = 'B';
      else if (percentage >= 60) grade = 'C';
      else if (percentage >= 50) grade = 'D';
      else grade = 'F';
    }

    // 5. Upsert only this student's mark
    if (absent || obtained !== null) {
      await query(`
        INSERT INTO institute_exam_marks (exam_id, student_id, marks_obtained, is_absent, percentage, grade, notes, entered_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          marks_obtained = VALUES(marks_obtained),
          is_absent = VALUES(is_absent),
          percentage = VALUES(percentage),
          grade = VALUES(grade),
          notes = VALUES(notes),
          entered_by = VALUES(entered_by),
          updated_at = CURRENT_TIMESTAMP
      `, [examId, student_id, obtained, absent, percentage, grade, notes, user.id]);
    } else {
      await query(
        `DELETE FROM institute_exam_marks WHERE exam_id = ? AND student_id = ?`,
        [examId, student_id]
      );
    }

    // 6. Return student's updated total & average for this exam_period
    const studentMarks = await query(`
      SELECT m.marks_obtained, m.is_absent, e.maximum_marks
      FROM institute_exam_marks m
      JOIN institute_exams e ON m.exam_id = e.id
      WHERE e.class_id = ? AND e.title = ? AND e.academic_year = ? AND m.student_id = ?
    `, [class_id, exam_period, academic_year, student_id]);

    let totalObtained = 0;
    let totalMax = 0;
    studentMarks.forEach(sm => {
      if (!sm.is_absent && sm.marks_obtained !== null) {
        totalObtained += parseFloat(sm.marks_obtained);
        totalMax += parseFloat(sm.maximum_marks || 100);
      }
    });

    res.json({
      success: true,
      data: {
        exam_id: examId,
        student_id,
        subject_id,
        marks_obtained: obtained,
        is_absent: absent,
        percentage,
        grade,
        student_total: Number(totalObtained.toFixed(2)),
        student_average: totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(1)) : null
      }
    });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 13. CLASS PROGRESSION, PROMOTIONS & GRADUATION
// ==========================================

async function getPromotionClassConfig(classId) {
  const [cls] = await query(`
    SELECT ic.*, nc.id AS configured_next_class_id, nc.name AS configured_next_class_name,
           nc.academic_year AS configured_next_class_year
    FROM institute_classes ic
    LEFT JOIN institute_classes nc ON nc.id = ic.next_class_id
    WHERE ic.id = ?
  `, [classId]);
  return cls;
}

function getResultCompletionState(resultsData) {
  const isTwoHalfClass = resultsData.exams?.some(e =>
    ['النصف الأول', 'النهائي الأول', 'النصف الثاني', 'النهائي الثاني'].includes(e.title)
  );
  const incompleteStudents = (resultsData.students || []).filter(student => (
    student.is_incomplete || student.is_provisional || (isTwoHalfClass && (!student.second_half || !student.second_half.is_complete))
  ));
  return { isTwoHalfClass, incompleteStudents };
}

export async function getClassProgression(req, res, next) {
  try {
    const classes = await query(`
      SELECT ic.id, ic.name, ic.section, ic.academic_year, ic.description, ic.is_active,
             ic.progression_order, ic.is_entry_class, ic.is_final_class,
             ic.next_class_id, ic.graduation_pass_threshold,
             nc.name AS next_class_name, nc.academic_year AS next_class_year,
             (SELECT COUNT(*) FROM institute_enrollments ie WHERE ie.class_id = ic.id AND ie.status = 'active') as student_count
      FROM institute_classes ic
      LEFT JOIN institute_classes nc ON nc.id = ic.next_class_id
      ORDER BY ic.progression_order ASC, ic.id ASC
    `);
    res.json({ success: true, data: classes });
  } catch (error) {
    next(error);
  }
}

export async function updateClassProgression(req, res, next) {
  try {
    const user = req.session.user;
    const { classes } = req.body;
    if (!Array.isArray(classes) || classes.length === 0) {
      return res.status(400).json({ success: false, error: 'Liiska qaabeynta fasallada waa qasab.' });
    }

    const classIds = new Set(classes.map(item => Number(item.id)).filter(Boolean));
    for (const item of classes) {
      const classId = Number(item.id);
      const nextClassId = item.is_final_class ? null : (item.next_class_id ? Number(item.next_class_id) : null);
      if (!classId || (nextClassId && nextClassId === classId)) {
        return res.status(400).json({ success: false, error: 'Fasalku iskama dhaxli karo (self-link).' });
      }
      if (nextClassId && classIds.has(nextClassId)) continue;
      if (nextClassId) {
        const [nextClass] = await query(`SELECT id, is_active FROM institute_classes WHERE id = ?`, [nextClassId]);
        if (!nextClass || !nextClass.is_active) {
          return res.status(400).json({ success: false, error: 'Fasalka xiga ma jiro ama ma shaqaynayo.' });
        }
      }
    }

    await withTransaction(async (conn) => {
      for (const item of classes) {
        const nextClassId = item.is_final_class ? null : (item.next_class_id ? Number(item.next_class_id) : null);
        const threshold = item.graduation_pass_threshold === '' || item.graduation_pass_threshold === undefined
          ? null
          : Number(item.graduation_pass_threshold);
        if (threshold !== null && (!Number.isFinite(threshold) || threshold < 0 || threshold > 100)) {
          throw Object.assign(new Error('Graduation threshold waa inuu u dhexeeyaa 0 iyo 100.'), { status: 400 });
        }
        await conn.execute(`
          UPDATE institute_classes
          SET next_class_id = ?,
              graduation_pass_threshold = ?,
              is_final_class = ?,
              progression_order = COALESCE(?, progression_order),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          nextClassId,
          threshold,
          item.is_final_class ? 1 : 0,
          item.progression_order !== undefined ? Number(item.progression_order) : null,
          Number(item.id)
        ]);
      }
    });

    await logAudit({
      userId: user.id,
      action: 'UPDATE_PROMOTION_CLASS_CONFIGURATION',
      module: 'classes',
      division: 'institute',
      details: `Updated explicit next-class and graduation configuration for ${classes.length} classes`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Qaabeynta dallacsiinta fasallada si guul leh ayaa loo kaydiyay.' });
  } catch (error) {
    next(error);
  }
}

export async function confirmFinalResults(req, res, next) {
  try {
    const user = req.session.user;
    const { class_id, academic_year = '2026', confirmation_note } = req.body;
    if (!class_id) {
      return res.status(400).json({ success: false, error: 'class_id waa qasab.' });
    }
    const cls = await getPromotionClassConfig(class_id);
    if (!cls) return res.status(404).json({ success: false, error: 'Fasalka lama helin.' });

    const resultsData = await computeAnnualPromotionResults({ class_id, academic_year });
    const { incompleteStudents } = getResultCompletionState(resultsData);
    if (!resultsData.students?.length) {
      return res.status(400).json({ success: false, error: 'Fasalkan ma laha natiijooyin sannadeed oo la xaqiijin karo.' });
    }
    if (incompleteStudents.length > 0) {
      return res.status(409).json({
        success: false,
        error: `${incompleteStudents.length} arday wali waxay leeyihiin natiijo aan dhamaystirnayn. Marka hore dhammee natiijooyinka.`
      });
    }

    await query(`
      INSERT INTO promotion_result_confirmations (class_id, academic_year, confirmed_by, confirmation_note)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE confirmed_by = VALUES(confirmed_by), confirmation_note = VALUES(confirmation_note), confirmed_at = CURRENT_TIMESTAMP
    `, [class_id, academic_year, user.id, confirmation_note?.trim() || null]);

    await logAudit({
      userId: user.id,
      action: 'CONFIRM_FINAL_RESULTS_FOR_PROMOTION',
      module: 'exams',
      division: 'institute',
      recordId: class_id,
      details: `Confirmed final results for class ${cls.name}, academic year ${academic_year}`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Natiijooyinka kama-dambaysta ah waa la xaqiijiyay. Hadda dallacsiinta waa la fulin karaa.' });
  } catch (error) {
    next(error);
  }
}

export async function getPromotionPreview(req, res, next) {
  try {
    const { class_id, academic_year = '2026' } = req.query;
    if (!class_id) return res.status(400).json({ success: false, error: 'class_id waa qasab.' });

    const cls = await getPromotionClassConfig(class_id);
    if (!cls) return res.status(404).json({ success: false, error: 'Fasalka lama helin.' });

    const [config] = await query(`SELECT * FROM academic_year_assessment_configs WHERE academic_year = ?`, [academic_year]);
    const configuredThreshold = config ? parseFloat(config.pass_threshold) : 50.00;
    const passThreshold = Boolean(cls.is_final_class) && cls.graduation_pass_threshold !== null
      ? parseFloat(cls.graduation_pass_threshold)
      : configuredThreshold;
    const nextClass = cls.configured_next_class_id ? {
      id: cls.configured_next_class_id,
      name: cls.configured_next_class_name,
      academic_year: cls.configured_next_class_year
    } : null;
    const isFinalClass = Boolean(cls.is_final_class);
    const configurationError = !isFinalClass && !nextClass
      ? 'Fasalkan looma dejin fasalka xiga. Dallacsiin lama fulin karo.'
      : null;

    const [confirmation] = await query(`
      SELECT prc.id, prc.academic_year, prc.confirmed_at, prc.confirmation_note,
             u.full_name AS confirmed_by_name
      FROM promotion_result_confirmations prc
      LEFT JOIN users u ON u.id = prc.confirmed_by
      WHERE prc.class_id = ? AND prc.academic_year = ?
    `, [class_id, academic_year]);

    const resultsData = await computeAnnualPromotionResults({ class_id, academic_year });
    const { isTwoHalfClass, incompleteStudents } = getResultCompletionState(resultsData);
    const existingPromotions = await query(`
      SELECT student_id, outcome, to_class_id, is_override, override_reason, created_at
      FROM student_promotion_history
      WHERE from_academic_year = ? AND from_class_id = ?
    `, [academic_year, class_id]);
    const promoMap = new Map(existingPromotions.map(promotion => [promotion.student_id, promotion]));

    const students = (resultsData.students || []).map(student => {
      const existing = promoMap.get(student.student_id);
      const isTwoHalfIncomplete = isTwoHalfClass && (!student.second_half || !student.second_half.is_complete);
      const isComplete = !student.is_incomplete && !isTwoHalfIncomplete;
      const overallPct = student.average_percentage === null || student.average_percentage === undefined
        ? 0
        : Number(student.average_percentage);
      const passedOverall = overallPct >= passThreshold;
      let decision = existing?.outcome || null;
      let targetClassId = existing?.to_class_id || null;

      if (!existing) {
        if (!isComplete) decision = 'incomplete';
        else if (passedOverall && configurationError) decision = 'configuration_error';
        else if (passedOverall && isFinalClass) decision = 'graduated';
        else if (passedOverall) {
          decision = 'promoted';
          targetClassId = nextClass.id;
        } else {
          decision = 'retained';
          targetClassId = cls.id;
        }
      }

      const targetClassName = targetClassId === nextClass?.id
        ? nextClass.name
        : targetClassId === cls.id
          ? cls.name
          : decision === 'graduated'
            ? 'Qalin-jabiyay (Graduated)'
            : '-';
      return {
        student_id: student.student_id,
        student_code: student.student_code,
        student_name: student.student_name,
        full_name: student.full_name || student.student_name,
        overall_total: student.total_obtained,
        total_marks: student.total_obtained,
        maximum_total: student.maximum_total,
        average_percentage: overallPct,
        is_incomplete: !isComplete,
        is_provisional: !isComplete,
        passed_overall: passedOverall,
        decision,
        target_class_id: targetClassId,
        target_class_name: targetClassName,
        is_promoted_already: Boolean(existing),
        existing_promotion: existing || null
      };
    });

    const summary = students.reduce((counts, student) => {
      const key = student.is_promoted_already ? 'already_processed' : student.decision;
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});

    res.json({
      success: true,
      data: {
        current_class: cls,
        next_class: nextClass,
        is_final_class: isFinalClass,
        configuration_error: configurationError,
        pass_threshold: passThreshold,
        academic_year,
        results_confirmed: Boolean(confirmation),
        confirmation: confirmation || null,
        unresolved_count: incompleteStudents.length,
        automatic_promotion_ready: Boolean(confirmation) && !configurationError,
        summary,
        students
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function executePromotions(req, res, next) {
  try {
    const user = req.session.user;
    const {
      from_academic_year = '2026',
      to_academic_year = String(Number(from_academic_year) + 1),
      class_id,
      student_ids
    } = req.body;
    if (!class_id) return res.status(400).json({ success: false, error: 'class_id waa qasab.' });

    const cls = await getPromotionClassConfig(class_id);
    if (!cls) return res.status(404).json({ success: false, error: 'Fasalka lama helin.' });
    const nextClass = cls.configured_next_class_id ? { id: cls.configured_next_class_id, name: cls.configured_next_class_name } : null;
    if (!cls.is_final_class && !nextClass) {
      return res.status(409).json({ success: false, error: 'Fasalkan looma dejin fasalka xiga.' });
    }

    let [confirmation] = await query(`
      SELECT id FROM promotion_result_confirmations WHERE class_id = ? AND academic_year = ?
    `, [class_id, from_academic_year]);
    if (!confirmation && (req.body.auto_confirm || req.body.force_confirm)) {
      await query(`
        INSERT INTO promotion_result_confirmations (class_id, academic_year, confirmed_by, confirmation_note)
        VALUES (?, ?, ?, 'Auto-confirmed upon promotion execution')
        ON DUPLICATE KEY UPDATE confirmed_at = CURRENT_TIMESTAMP
      `, [class_id, from_academic_year, user?.id || 1]);
      [confirmation] = await query(`SELECT id FROM promotion_result_confirmations WHERE class_id = ? AND academic_year = ?`, [class_id, from_academic_year]);
    }
    if (!confirmation) {
      return res.status(409).json({ success: false, error: 'Natiijooyinka kama-dambaysta ah wali si rasmi ah looma xaqiijin.' });
    }

    const [config] = await query(`SELECT * FROM academic_year_assessment_configs WHERE academic_year = ?`, [from_academic_year]);
    const configuredThreshold = config ? parseFloat(config.pass_threshold) : 50.00;
    const passThreshold = Boolean(cls.is_final_class) && cls.graduation_pass_threshold !== null
      ? parseFloat(cls.graduation_pass_threshold)
      : configuredThreshold;
    const resultsData = await computeAnnualPromotionResults({ class_id, academic_year: from_academic_year });
    const { isTwoHalfClass } = getResultCompletionState(resultsData);
    const studentsMap = new Map((resultsData.students || []).map(student => [String(student.student_id), student]));
    const selectedIds = Array.isArray(student_ids) && student_ids.length > 0
      ? student_ids.map(String)
      : Array.from(studentsMap.keys());
    const counts = { processed: 0, promoted: 0, retained: 0, graduated: 0, skipped: 0, already_processed: 0 };

    await withTransaction(async (conn) => {
      for (const studentId of selectedIds) {
        const [existing] = await conn.execute(`
          SELECT id FROM student_promotion_history
          WHERE student_id = ? AND from_academic_year = ?
          FOR UPDATE
        `, [studentId, from_academic_year]);
        if (existing.length > 0) {
          counts.already_processed += 1;
          continue;
        }

        const student = studentsMap.get(String(studentId));
        if (!student) {
          counts.skipped += 1;
          continue;
        }
        const isIncomplete = student.is_incomplete || (isTwoHalfClass && (!student.second_half || !student.second_half.is_complete));
        if (isIncomplete) {
          counts.skipped += 1;
          continue;
        }

        const overallPct = student.average_percentage === null || student.average_percentage === undefined
          ? 0
          : Number(student.average_percentage);
        const passedOverall = overallPct >= passThreshold;
        let outcome = 'retained';
        let targetClassId = cls.id;

        if (passedOverall && cls.is_final_class) {
          outcome = 'graduated';
          targetClassId = null;
          await conn.execute(`
            UPDATE institute_enrollments SET status = 'graduated'
            WHERE student_id = ? AND class_id = ? AND status = 'active'
          `, [studentId, class_id]);
          counts.graduated += 1;
        } else if (passedOverall && nextClass) {
          outcome = 'promoted';
          targetClassId = nextClass.id;
          await conn.execute(`
            UPDATE institute_enrollments SET status = 'completed'
            WHERE student_id = ? AND class_id = ? AND status = 'active'
          `, [studentId, class_id]);
          await conn.execute(`
            INSERT INTO institute_enrollments (student_id, class_id, enrollment_date, status)
            VALUES (?, ?, CURDATE(), 'active')
            ON DUPLICATE KEY UPDATE status = 'active'
          `, [studentId, nextClass.id]);
          counts.promoted += 1;
        } else {
          counts.retained += 1;
        }

        await conn.execute(`
          INSERT INTO student_promotion_history
            (student_id, from_academic_year, to_academic_year, from_class_id, to_class_id, outcome, overall_total, overall_percentage, processed_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [studentId, from_academic_year, to_academic_year, class_id, targetClassId, outcome, student.total_obtained || null, overallPct, user.id]);
        counts.processed += 1;
      }
    });

    await logAudit({
      userId: user.id,
      action: 'EXECUTE_AUTOMATIC_PROMOTIONS',
      module: 'exams',
      division: 'institute',
      details: { class_id, from_academic_year, to_academic_year, counts },
      ipAddress: req.ip
    });
    res.json({ success: true, data: counts, message: `Dallacsiinta waa la fuliyay (${counts.promoted} la dallacsiiyay, ${counts.graduated} qalin-jabiyay, ${counts.retained} ku haray).` });
  } catch (error) {
    next(error);
  }
}

export async function overrideStudentPromotion(req, res, next) {
  try {
    const user = req.session.user;
    if (!['super_admin', 'institute_admin'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Kaliya maamulka machadka ayaa samayn kara manual promotion.' });
    }
    const {
      student_id,
      from_academic_year = '2026',
      to_academic_year = String(Number(from_academic_year) + 1),
      from_class_id,
      target_class_id,
      outcome,
      reason
    } = req.body;
    if (!student_id || !reason?.trim() || !['promoted', 'retained', 'graduated'].includes(outcome)) {
      return res.status(400).json({ success: false, error: 'Ardayga, go\'aanka iyo sababta rasmiga ah waa qasab.' });
    }

    const enrollmentSql = from_class_id
      ? `SELECT ie.class_id, ic.* FROM institute_enrollments ie JOIN institute_classes ic ON ic.id = ie.class_id WHERE ie.student_id = ? AND ie.class_id = ? AND ie.status = 'active' LIMIT 1`
      : `SELECT ie.class_id, ic.* FROM institute_enrollments ie JOIN institute_classes ic ON ic.id = ie.class_id WHERE ie.student_id = ? AND ie.status = 'active' ORDER BY ie.id DESC LIMIT 1`;
    const [currentClass] = await query(enrollmentSql, from_class_id ? [student_id, from_class_id] : [student_id]);
    if (!currentClass) return res.status(404).json({ success: false, error: 'Ardaygu ma laha enrollment active ah oo laga dallacsiin karo.' });

    const configuredNextClassId = currentClass.next_class_id ? Number(currentClass.next_class_id) : null;
    let targetClassId = outcome === 'retained' ? currentClass.class_id : (target_class_id ? Number(target_class_id) : configuredNextClassId);
    if (outcome === 'promoted' && (!configuredNextClassId || targetClassId !== configuredNextClassId)) {
      return res.status(400).json({ success: false, error: 'Manual promotion-ku waa inuu u socdaa fasalka xiga ee qaabeynta.' });
    }
    if (outcome === 'graduated' && !currentClass.is_final_class) {
      return res.status(400).json({ success: false, error: 'Arday waxaa laga qalin-jabin karaa oo keliya fasalka final-ka ee la qaabeeyay.' });
    }
    if (outcome !== 'graduated' && !targetClassId) {
      return res.status(400).json({ success: false, error: 'Fasalka loo wareejinayo lama helin.' });
    }

    const resultsData = await computeAnnualPromotionResults({ class_id: currentClass.class_id, academic_year: from_academic_year });
    const result = (resultsData.students || []).find(student => String(student.student_id) === String(student_id));
    const existing = await query(`SELECT id, outcome FROM student_promotion_history WHERE student_id = ? AND from_academic_year = ?`, [student_id, from_academic_year]);
    if (existing[0]?.outcome === 'graduated' || existing[0]?.outcome === 'promoted') {
      return res.status(409).json({ success: false, error: 'Ardaygan horey ayaa loogu fuliyay dallacsiin ama qalin-jabin sannadkan.' });
    }

    await withTransaction(async (conn) => {
      if (outcome === 'graduated') {
        await conn.execute(`UPDATE institute_enrollments SET status = 'graduated' WHERE student_id = ? AND class_id = ? AND status = 'active'`, [student_id, currentClass.class_id]);
      } else if (outcome === 'promoted') {
        await conn.execute(`UPDATE institute_enrollments SET status = 'completed' WHERE student_id = ? AND class_id = ? AND status = 'active'`, [student_id, currentClass.class_id]);
        await conn.execute(`
          INSERT INTO institute_enrollments (student_id, class_id, enrollment_date, status)
          VALUES (?, ?, CURDATE(), 'active')
          ON DUPLICATE KEY UPDATE status = 'active'
        `, [student_id, targetClassId]);
      }

      await conn.execute(`
        INSERT INTO student_promotion_history
          (student_id, from_academic_year, to_academic_year, from_class_id, to_class_id, outcome, overall_total, overall_percentage, is_override, override_reason, processed_by)
        VALUES (?, ?, ?, ?, ?, 'manual_override', ?, ?, 1, ?, ?)
        ON DUPLICATE KEY UPDATE
          to_class_id = VALUES(to_class_id), outcome = 'manual_override',
          overall_total = VALUES(overall_total), overall_percentage = VALUES(overall_percentage),
          is_override = 1, override_reason = VALUES(override_reason), processed_by = VALUES(processed_by), created_at = CURRENT_TIMESTAMP
      `, [student_id, from_academic_year, to_academic_year, currentClass.class_id, outcome === 'graduated' ? null : targetClassId, result?.total_obtained || null, result?.average_percentage || null, reason.trim(), user.id]);
    });

    await logAudit({
      userId: user.id,
      action: 'MANUAL_STUDENT_PROMOTION_OVERRIDE',
      module: 'exams',
      division: 'institute',
      recordId: student_id,
      details: {
        student_id,
        from_class_id: currentClass.class_id,
        target_class_id: outcome === 'graduated' ? null : targetClassId,
        result: result?.average_percentage ?? null,
        outcome,
        reason: reason.trim()
      },
      ipAddress: req.ip
    });
    res.json({ success: true, message: 'Manual promotion-ka si rasmi ah ayaa loo fuliyay, sababtiisana audit ayaa lagu kaydiyay.' });
  } catch (error) {
    next(error);
  }
}

export async function getPromotionHistory(req, res, next) {
  try {
    const { academic_year, class_id, student_id } = req.query;
    let sql = `
      SELECT sph.*, s.student_id AS student_code, s.full_name,
             fc.name AS from_class_name, tc.name AS to_class_name,
             u.full_name AS processed_by_name
      FROM student_promotion_history sph
      JOIN students s ON s.id = sph.student_id
      JOIN institute_classes fc ON fc.id = sph.from_class_id
      LEFT JOIN institute_classes tc ON tc.id = sph.to_class_id
      LEFT JOIN users u ON u.id = sph.processed_by
      WHERE 1=1
    `;
    const params = [];
    if (academic_year) { sql += ` AND sph.from_academic_year = ?`; params.push(academic_year); }
    if (class_id) { sql += ` AND sph.from_class_id = ?`; params.push(class_id); }
    if (student_id) { sql += ` AND sph.student_id = ?`; params.push(student_id); }
    sql += ` ORDER BY sph.created_at DESC, sph.id DESC`;
    res.json({ success: true, data: await query(sql, params) });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 14. COMPREHENSIVE HISTORICAL EXAM REPORTS
// ==========================================

export async function getHistoricalExamReports(req, res, next) {
  try {
    const {
      search,
      student_id,
      academic_year,
      class_id,
      exam_period,
      subject_id,
      export_xlsx
    } = req.query;

    // Detailed single student historical drilldown
    if (student_id) {
      const [student] = await query(`
        SELECT id, student_id as student_code, full_name, gender, phone, is_active, created_at
        FROM students WHERE id = ?
      `, [student_id]);

      if (!student) {
        return res.status(404).json({ success: false, error: 'Ardayga lama helin.' });
      }

      // 1. Enrollment history
      const enrollments = await query(`
        SELECT ie.id, ie.class_id, ie.enrollment_date, ie.status,
               ic.name as class_name, ic.academic_year
        FROM institute_enrollments ie
        JOIN institute_classes ic ON ie.class_id = ic.id
        WHERE ie.student_id = ?
        ORDER BY ic.academic_year DESC, ie.id DESC
      `, [student_id]);

      // 2. All examination marks across all years and exams
      let marksSql = `
        SELECT m.id as mark_id, m.marks_obtained, m.is_absent, m.percentage, m.grade, m.notes,
               e.id as exam_id, e.title as exam_title, e.academic_year, e.maximum_marks, e.exam_date,
               ic.id as historical_class_id, ic.name as historical_class_name,
               s.id as subject_id, s.name as subject_name, s.code as subject_code
        FROM institute_exam_marks m
        JOIN institute_exams e ON m.exam_id = e.id
        JOIN institute_classes ic ON e.class_id = ic.id
        JOIN institute_subjects s ON e.subject_id = s.id
        WHERE m.student_id = ?
      `;
      const marksParams = [student_id];

      if (academic_year) {
        marksSql += ` AND e.academic_year = ?`;
        marksParams.push(academic_year);
      }
      if (exam_period && exam_period !== 'all') {
        if (['first_half', 'half_1', 'النصف الأول (Wadar)'].includes(exam_period)) {
          marksSql += ` AND e.title IN ('النصف الأول', 'النهائي الأول')`;
        } else if (['second_half', 'half_2', 'النصف الثاني (Wadar)'].includes(exam_period)) {
          marksSql += ` AND e.title IN ('النصف الثاني', 'النهائي الثاني')`;
        } else {
          marksSql += ` AND e.title = ?`;
          marksParams.push(exam_period);
        }
      }
      if (subject_id) {
        marksSql += ` AND s.id = ?`;
        marksParams.push(subject_id);
      }

      marksSql += ` ORDER BY e.academic_year DESC, e.exam_date DESC, s.name ASC`;
      const marks = await query(marksSql, marksParams);

      // Group marks by academic year and exam title
      const yearGroups = {};
      marks.forEach(m => {
        const yr = m.academic_year || 'Unknown';
        if (!yearGroups[yr]) {
          yearGroups[yr] = {
            academic_year: yr,
            class_name: m.historical_class_name,
            exams: {}
          };
        }
        const exTitle = m.exam_title;
        if (!yearGroups[yr].exams[exTitle]) {
          yearGroups[yr].exams[exTitle] = {
            exam_title: exTitle,
            exam_date: m.exam_date,
            marks: [],
            total_obtained: 0,
            total_maximum: 0
          };
        }
        yearGroups[yr].exams[exTitle].marks.push(m);
        if (!m.is_absent && m.marks_obtained !== null) {
          yearGroups[yr].exams[exTitle].total_obtained += parseFloat(m.marks_obtained);
          yearGroups[yr].exams[exTitle].total_maximum += parseFloat(m.maximum_marks || 100);
        }
      });

      // Compute Two-Half summary for each historical year
      Object.values(yearGroups).forEach(y => {
        let h1Obt = 0;
        let h1Max = 0;
        let h1Count = 0;
        let h2Obt = 0;
        let h2Max = 0;
        let h2Count = 0;

        Object.values(y.exams).forEach(ex => {
          if (ex.exam_title === 'النصف الأول' || ex.exam_title === 'النهائي الأول') {
            h1Obt += ex.total_obtained;
            h1Max += ex.total_maximum;
            h1Count++;
          }
          if (ex.exam_title === 'النصف الثاني' || ex.exam_title === 'النهائي الثاني') {
            h2Obt += ex.total_obtained;
            h2Max += ex.total_maximum;
            h2Count++;
          }
        });

        y.first_half = {
          total_obtained: Number(h1Obt.toFixed(2)),
          total_maximum: h1Max,
          percentage: h1Max > 0 ? Number(((h1Obt / h1Max) * 100).toFixed(1)) : 0,
          status: h1Count >= 2 ? 'completed' : (h1Count === 1 ? 'provisional' : 'none')
        };

        y.second_half = {
          total_obtained: Number(h2Obt.toFixed(2)),
          total_maximum: h2Max,
          percentage: h2Max > 0 ? Number(((h2Obt / h2Max) * 100).toFixed(1)) : 0,
          status: h2Count >= 2 ? 'completed' : (h2Count === 1 ? 'provisional' : 'none')
        };
      });

      // 3. Promotion & Graduation history
      const promotions = await query(`
        SELECT sph.*, 
               fc.name as from_class_name,
               tc.name as to_class_name,
               u.full_name as processed_by_name
        FROM student_promotion_history sph
        JOIN institute_classes fc ON sph.from_class_id = fc.id
        LEFT JOIN institute_classes tc ON sph.to_class_id = tc.id
        LEFT JOIN users u ON sph.processed_by = u.id
        WHERE sph.student_id = ?
        ORDER BY sph.created_at DESC
      `, [student_id]);

      return res.json({
        success: true,
        data: {
          student,
          enrollments,
          historical_years: Object.values(yearGroups).map(y => ({
            ...y,
            exams: Object.values(y.exams)
          })),
          promotions
        }
      });
    }

    // List / search query across all students (current and former)
    let sql = `
      SELECT DISTINCT s.id as student_id, s.student_id as student_code, s.full_name, s.gender, s.phone,
             s.is_active,
             (SELECT ie.status FROM institute_enrollments ie WHERE ie.student_id = s.id ORDER BY ie.id DESC LIMIT 1) as current_enrollment_status,
             (SELECT ic.name FROM institute_enrollments ie JOIN institute_classes ic ON ie.class_id = ic.id WHERE ie.student_id = s.id ORDER BY ie.id DESC LIMIT 1) as current_class_name,
             (SELECT COUNT(*) FROM institute_exam_marks m WHERE m.student_id = s.id) as recorded_marks_count
      FROM students s
      LEFT JOIN institute_enrollments ie ON s.id = ie.student_id
      LEFT JOIN institute_classes ic ON ie.class_id = ic.id
      LEFT JOIN institute_exam_marks m ON s.id = m.student_id
      LEFT JOIN institute_exams e ON m.exam_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      const q = `%${search.trim()}%`;
      sql += ` AND (s.full_name LIKE ? OR s.student_id LIKE ? OR s.phone LIKE ?)`;
      params.push(q, q, q);
    }
    if (academic_year) {
      sql += ` AND (ic.academic_year = ? OR e.academic_year = ?)`;
      params.push(academic_year, academic_year);
    }
    if (class_id) {
      sql += ` AND (ie.class_id = ? OR e.class_id = ?)`;
      params.push(class_id, class_id);
    }
    if (exam_period && exam_period !== 'all') {
      sql += ` AND e.title = ?`;
      params.push(exam_period);
    }
    if (subject_id) {
      sql += ` AND e.subject_id = ?`;
      params.push(subject_id);
    }

    sql += ` ORDER BY s.full_name ASC LIMIT 100`;
    const students = await query(sql, params);

    // If Excel export requested
    if (export_xlsx === 'true' || export_xlsx === '1') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'معهد التفسير للعلوم الشرعية والعربية';
      const sheet = workbook.addWorksheet('Diiwaanka Taariikhda Imtixaanka');

      sheet.mergeCells('A1:F1');
      sheet.getCell('A1').value = 'معهد التفسير للعلوم الشرعية والعربية - Warbixinta Taariikhda Imtixaanaadka ee Ardayda';
      sheet.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getCell('A1').alignment = { horizontal: 'center' };
      sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };

      sheet.addRow([]);
      sheet.addRow([
        'No.',
        'Aqoonsiga (ID)',
        'Magaca Buuxa',
        'Telefoonka',
        'Fasalka Ugu Dambeeyay',
        'Xaaladda (Status)'
      ]);

      const headerRow = sheet.getRow(3);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };

      students.forEach((st, idx) => {
        sheet.addRow([
          idx + 1,
          sanitizeForExcel(st.student_code),
          sanitizeForExcel(st.full_name),
          sanitizeForExcel(st.phone || '-'),
          sanitizeForExcel(st.current_class_name || '-'),
          st.current_enrollment_status === 'graduated' ? 'Qalin-jabiyay' : (st.is_active ? 'Dhiganaya' : 'Hore')
        ]);
      });

      sheet.columns = [
        { width: 8 }, { width: 18 }, { width: 32 }, { width: 18 }, { width: 25 }, { width: 18 }
      ];

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=taariikhda-imtixaanaadka-${Date.now()}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
      return;
    }

    res.json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
}

export async function setupStandardExamScheme(req, res, next) {
  try {
    const user = req.session.user;
    const { academic_year = '2026', pass_threshold = 50.00 } = req.body;

    // 1. Ensure Assessment Config is set to mode_a (40 + 60 = 100), pass_threshold 50%
    await query(`
      INSERT INTO academic_year_assessment_configs 
        (academic_year, marking_mode, mode_b_calculation, pass_threshold, description)
      VALUES (?, 'mode_a', 'average', ?, 'Standard 40/60 Midterm and Final Scheme')
      ON DUPLICATE KEY UPDATE
        marking_mode = 'mode_a',
        pass_threshold = VALUES(pass_threshold),
        description = VALUES(description),
        updated_at = CURRENT_TIMESTAMP
    `, [academic_year, parseFloat(pass_threshold) || 50.00]);

    // 2. Insert or update Midterm (40 Marks)
    const [existingMid] = await query(
      `SELECT id FROM exam_periods WHERE academic_year = ? AND (exam_type = 'midterm' OR name LIKE '%Midterm%' OR name LIKE '%Niska%') LIMIT 1`,
      [academic_year]
    );
    let midId;
    if (existingMid) {
      await query(
        `UPDATE exam_periods SET name = 'Midterm (Imtixaanka Niska)', exam_type = 'midterm', sequence_order = 1, max_contribution = 40.00, status = 'active' WHERE id = ?`,
        [existingMid.id]
      );
      midId = existingMid.id;
    } else {
      const insMid = await query(
        `INSERT INTO exam_periods (name, academic_year, exam_type, sequence_order, max_contribution, status, description)
         VALUES ('Midterm (Imtixaanka Niska)', ?, 'midterm', 1, 40.00, 'active', 'Imtixaanka Niska ee 40-ka dhibcood')`,
        [academic_year]
      );
      midId = insMid.insertId;
    }

    // 3. Insert or update Final (60 Marks)
    const [existingFin] = await query(
      `SELECT id FROM exam_periods WHERE academic_year = ? AND (exam_type = 'final' OR name LIKE '%Final%' OR name LIKE '%Kama-dambays%') LIMIT 1`,
      [academic_year]
    );
    let finId;
    if (existingFin) {
      await query(
        `UPDATE exam_periods SET name = 'Final (Imtixaanka Kama-dambaysta ah)', exam_type = 'final', sequence_order = 2, max_contribution = 60.00, status = 'active' WHERE id = ?`,
        [existingFin.id]
      );
      finId = existingFin.id;
    } else {
      const insFin = await query(
        `INSERT INTO exam_periods (name, academic_year, exam_type, sequence_order, max_contribution, status, description)
         VALUES ('Final (Imtixaanka Kama-dambaysta ah)', ?, 'final', 2, 60.00, 'active', 'Imtixaanka Kama-dambaysta ah ee 60-ka dhibcood')`,
        [academic_year]
      );
      finId = insFin.insertId;
    }

    // 4. Also register the exam set so connected queries work automatically
    let [set] = await query(`SELECT id FROM institute_exam_sets WHERE academic_year = ? LIMIT 1`, [academic_year]);
    let setId;
    if (!set) {
      const setIns = await query(
        `INSERT INTO institute_exam_sets (name, academic_year, description, status, created_by)
         VALUES (?, ?, 'Standard 40/60 Semester Assessment Set', 'configured', ?)`,
        [`${academic_year} Standard 40/60 Examination`, academic_year, user?.id || 1]
      );
      setId = setIns.insertId;
    } else {
      setId = set.id;
    }
    await query(`DELETE FROM institute_exam_set_members WHERE exam_set_id = ?`, [setId]);
    await query(`
      INSERT INTO institute_exam_set_members (exam_set_id, exam_period_id, sequence_order, maximum_marks, is_required)
      VALUES (?, ?, 1, 40.00, 1), (?, ?, 2, 60.00, 1)
    `, [setId, midId, setId, finId]);

    await logAudit({
      userId: user.id,
      action: 'SETUP_STANDARD_EXAM_SCHEME',
      module: 'exams',
      division: 'institute',
      recordId: academic_year,
      details: `Configured standard 40/60 scheme: Midterm=40, Final=60, pass_threshold=${pass_threshold}%`
    });

    res.json({
      success: true,
      message: 'Nidaamka rasmiga ah ee 40/60 (Midterm 40 & Final 60) si guul leh ayaa loo dejiyay.',
      data: { academic_year, midId, finId, setId, pass_threshold }
    });
  } catch (error) {
    next(error);
  }
}

export async function saveSchemeRule(req, res, next) {
  try {
    const user = req.session.user;
    const {
      academic_year = '2026',
      pass_threshold = 50.00,
      description = '',
      exams = [],
      exam1_name,
      exam2_name
    } = req.body;

    const threshold = parseFloat(pass_threshold);
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      return res.status(400).json({ success: false, error: 'Heerka baaska waa inuu u dhexeeyaa 0 iyo 100%.' });
    }

    // Strictly 2 connected exams: First Exam (40 marks) and Final Exam (60 marks) = 100 marks total
    const name1 = (exam1_name || exams[0]?.name || 'Midterm (Imtixaanka Niska)').trim();
    const name2 = (exam2_name || exams[1]?.name || 'Final (Imtixaanka Kama-dambaysta ah)').trim();

    if (!name1) {
      return res.status(400).json({ success: false, error: 'Fadlan geli magaca imtixaanka 1-aad (Midterm).' });
    }
    if (!name2) {
      return res.status(400).json({ success: false, error: 'Fadlan geli magaca imtixaanka 2-aad ee kama-dambaysta ah (Final).' });
    }

    const enforcedExams = [
      { id: exams[0]?.id, name: name1, exam_type: 'midterm', sequence_order: 1, max_contribution: 40.00 },
      { id: exams[1]?.id, name: name2, exam_type: 'final', sequence_order: 2, max_contribution: 60.00 }
    ];

    // 1. Update/create assessment config
    await query(`
      INSERT INTO academic_year_assessment_configs 
        (academic_year, marking_mode, mode_b_calculation, pass_threshold, description)
      VALUES (?, 'mode_a', 'average', ?, ?)
      ON DUPLICATE KEY UPDATE
        marking_mode = 'mode_a',
        pass_threshold = VALUES(pass_threshold),
        description = VALUES(description),
        updated_at = CURRENT_TIMESTAMP
    `, [academic_year, threshold, description || 'Official 40/60 Assessment Scheme']);

    // 2. Synchronize the 2 exam periods
    const membersToInsert = [];

    for (let i = 0; i < enforcedExams.length; i++) {
      const ex = enforcedExams[i];
      const examName = ex.name;
      const maxMarks = ex.max_contribution;
      const sequenceOrder = ex.sequence_order;
      const examType = ex.exam_type;

      let periodId;
      if (ex.id) {
        const [existing] = await query(`SELECT id FROM exam_periods WHERE id = ? AND academic_year = ?`, [ex.id, academic_year]);
        if (existing) {
          await query(`
            UPDATE exam_periods 
            SET name = ?, exam_type = ?, sequence_order = ?, max_contribution = ?, status = 'active'
            WHERE id = ?
          `, [examName, examType, sequenceOrder, maxMarks, ex.id]);
          periodId = ex.id;
        }
      }
      if (!periodId) {
        const [existingByType] = await query(`SELECT id FROM exam_periods WHERE (exam_type = ? OR sequence_order = ?) AND academic_year = ? ORDER BY id ASC LIMIT 1`, [examType, sequenceOrder, academic_year]);
        if (existingByType) {
          await query(`
            UPDATE exam_periods 
            SET name = ?, exam_type = ?, sequence_order = ?, max_contribution = ?, status = 'active'
            WHERE id = ?
          `, [examName, examType, sequenceOrder, maxMarks, existingByType.id]);
          periodId = existingByType.id;
        } else {
          const ins = await query(`
            INSERT INTO exam_periods (name, academic_year, exam_type, sequence_order, max_contribution, status, description)
            VALUES (?, ?, ?, ?, ?, 'active', 'Official 40/60 Exam Period')
          `, [examName, academic_year, examType, sequenceOrder, maxMarks]);
          periodId = ins.insertId;

          await query(
            `INSERT IGNORE INTO exam_fee_rules (academic_year, exam_period, amount, description) VALUES (?, ?, 10.00, 'Lacagta Rasmiga ah')`,
            [academic_year, examName]
          );
        }
      }
      membersToInsert.push({
        exam_period_id: periodId,
        sequence_order: sequenceOrder,
        maximum_marks: maxMarks
      });
    }

    // 3. Register or update institute_exam_sets and connect both exams
    let [set] = await query(`SELECT id FROM institute_exam_sets WHERE academic_year = ? LIMIT 1`, [academic_year]);
    let setId;
    if (!set) {
      const setIns = await query(
        `INSERT INTO institute_exam_sets (name, academic_year, description, status, created_by)
         VALUES (?, ?, 'Official 40/60 Connected Assessment Rule', 'configured', ?)`,
        [`${academic_year} Standard Examination Scheme`, academic_year, user?.id || 1]
      );
      setId = setIns.insertId;
    } else {
      setId = set.id;
      await query(`UPDATE institute_exam_sets SET name = ?, status = 'configured', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [`${academic_year} Standard Examination Scheme`, setId]);
    }

    await query(`DELETE FROM institute_exam_set_members WHERE exam_set_id = ?`, [setId]);
    for (const m of membersToInsert) {
      await query(`
        INSERT INTO institute_exam_set_members (exam_set_id, exam_period_id, sequence_order, maximum_marks, is_required)
        VALUES (?, ?, ?, ?, 1)
      `, [setId, m.exam_period_id, m.sequence_order, m.maximum_marks]);
    }

    // Connect exams
    await query(`
      UPDATE institute_exams e
      JOIN exam_periods ep ON BINARY ep.name = BINARY e.title AND BINARY ep.academic_year = BINARY e.academic_year
      JOIN institute_exam_set_members esm ON esm.exam_period_id = ep.id AND esm.exam_set_id = ?
      SET e.exam_set_id = ?, e.maximum_marks = esm.maximum_marks
      WHERE e.academic_year = ?
    `, [setId, setId, academic_year]);

    await logAudit({
      userId: user?.id || 1,
      action: 'SAVE_SCHEME_RULE',
      module: 'exams',
      division: 'institute',
      recordId: academic_year,
      details: `Saved official 40/60 exam rule for ${academic_year}: Exam 1='${name1}' (40 marks), Exam 2='${name2}' (60 marks), pass_threshold=${threshold}%`
    });

    res.json({
      success: true,
      message: 'Xeerka 40/60 ee labada imtixaan si guul leh ayaa loo kaydiyay.',
      data: { academic_year, setId, exam1_name: name1, exam2_name: name2, pass_threshold: threshold }
    });
  } catch (error) {
    next(error);
  }
}




