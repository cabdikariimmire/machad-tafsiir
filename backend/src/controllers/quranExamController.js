import { query, withTransaction } from '../db/connection.js';
import { logAudit } from '../services/auditService.js';
import { isTeacherAssignedToGroup } from '../services/quranService.js';

// ============================================================================
// 1. CONFIGURABLE ERROR TYPES CONTROLLERS
// ============================================================================

/**
 * List all configured error types
 */
export async function getExamErrorTypes(req, res, next) {
  try {
    const { active_only } = req.query;
    let sql = `SELECT * FROM quran_exam_error_types`;
    const params = [];

    if (active_only === 'true' || active_only === '1') {
      sql += ` WHERE is_active = 1`;
    }

    sql += ` ORDER BY deduction_points ASC, id ASC`;
    const errorTypes = await query(sql, params);
    res.json({ success: true, data: errorTypes });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new configurable error type (Admin only)
 */
export async function createExamErrorType(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { name, name_ar, description, severity, deduction_points, is_active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Magaca nooca khaladka waa qasab.' });
    }

    const deduction = parseFloat(deduction_points);
    if (isNaN(deduction) || deduction < 0) {
      return res.status(400).json({ success: false, error: 'Dhibcaha jarista waa inay noqdaan tiro togan (positive number).' });
    }

    const validSeverities = ['low', 'medium', 'high'];
    const sev = validSeverities.includes(severity) ? severity : 'medium';
    const active = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    const result = await query(
      `INSERT INTO quran_exam_error_types (name, name_ar, description, severity, deduction_points, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), name_ar ? name_ar.trim() : null, description ? description.trim() : null, sev, deduction, active]
    );

    await logAudit({
      userId: currentUser.id,
      action: 'CREATE_EXAM_ERROR_TYPE',
      module: 'quran_exams',
      division: 'quran',
      recordId: result.insertId,
      details: `Created error type "${name.trim()}" with deduction ${deduction} pts (${sev})`,
      afterValue: { name, severity: sev, deduction_points: deduction },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Nooca khaladka si guul leh ayaa loo abuuray.',
      id: result.insertId
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an existing configurable error type (Admin only)
 */
export async function updateExamErrorType(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { id } = req.params;
    const { name, name_ar, description, severity, deduction_points, is_active } = req.body;

    const [existing] = await query('SELECT * FROM quran_exam_error_types WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Nooca khaladka lama helin.' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Magaca nooca khaladka waa qasab.' });
    }

    const deduction = parseFloat(deduction_points);
    if (isNaN(deduction) || deduction < 0) {
      return res.status(400).json({ success: false, error: 'Dhibcaha jarista waa inay noqdaan tiro togan.' });
    }

    const validSeverities = ['low', 'medium', 'high'];
    const sev = validSeverities.includes(severity) ? severity : existing.severity;
    const active = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

    await query(
      `UPDATE quran_exam_error_types 
       SET name = ?, name_ar = ?, description = ?, severity = ?, deduction_points = ?, is_active = ?
       WHERE id = ?`,
      [
        name.trim(),
        name_ar !== undefined ? (name_ar ? name_ar.trim() : null) : existing.name_ar,
        description !== undefined ? (description ? description.trim() : null) : existing.description,
        sev,
        deduction,
        active,
        id
      ]
    );

    await logAudit({
      userId: currentUser.id,
      action: 'UPDATE_EXAM_ERROR_TYPE',
      module: 'quran_exams',
      division: 'quran',
      recordId: id,
      details: `Updated error type "${name.trim()}" to deduction ${deduction} pts`,
      beforeValue: existing,
      afterValue: { name: name.trim(), severity: sev, deduction_points: deduction, is_active: active },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Nooca khaladka si guul leh ayaa loo cusbooneysiiyay.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Toggle active/inactive status of an error type
 */
export async function toggleExamErrorType(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { id } = req.params;

    const [existing] = await query('SELECT * FROM quran_exam_error_types WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Nooca khaladka lama helin.' });
    }

    const newStatus = existing.is_active ? 0 : 1;
    await query('UPDATE quran_exam_error_types SET is_active = ? WHERE id = ?', [newStatus, id]);

    await logAudit({
      userId: currentUser.id,
      action: newStatus ? 'ACTIVATE_ERROR_TYPE' : 'DEACTIVATE_ERROR_TYPE',
      module: 'quran_exams',
      division: 'quran',
      recordId: id,
      details: `${newStatus ? 'Activated' : 'Deactivated'} error type "${existing.name}"`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      is_active: newStatus,
      message: `Nooca khaladka waxaa laga dhigay: ${newStatus ? 'Shaqaynaya (Active)' : 'Xanniban (Inactive)'}`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete or safely deactivate an error type
 */
export async function deleteExamErrorType(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { id } = req.params;

    const [existing] = await query('SELECT * FROM quran_exam_error_types WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Nooca khaladka lama helin.' });
    }

    // Check if referenced in historical exam error entries
    const [usage] = await query('SELECT COUNT(*) as c FROM quran_student_exam_errors WHERE error_type_id = ?', [id]);
    if (usage.c > 0) {
      // Historical references exist: deactivate to preserve historical integrity
      await query('UPDATE quran_exam_error_types SET is_active = 0 WHERE id = ?', [id]);
      await logAudit({
        userId: currentUser.id,
        action: 'DEACTIVATE_ERROR_TYPE',
        module: 'quran_exams',
        division: 'quran',
        recordId: id,
        details: `Deactivated error type "${existing.name}" (${usage.c} historical records preserved)`,
        ipAddress: req.ip
      });
      return res.json({
        success: true,
        archived: true,
        message: `Nooca khaladkan waxaa lagu isticmaalay ${usage.c} imtixaan hore. Si loo dhowro xogta taariikheed, lama tiri karo laakiin waa la xannibay (deactivated).`
      });
    }

    // Safe to delete if never used
    await query('DELETE FROM quran_exam_error_types WHERE id = ?', [id]);
    await logAudit({
      userId: currentUser.id,
      action: 'DELETE_ERROR_TYPE',
      module: 'quran_exams',
      division: 'quran',
      recordId: id,
      details: `Permanently deleted unused error type "${existing.name}"`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      deleted: true,
      message: 'Nooca khaladka si joogto ah ayaa loo tirtiray.'
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// 2. STUDENT SEARCH FOR QURAN EXAMINATIONS
// ============================================================================

/**
 * Search students by Arabic name, Somali name, ID, or phone
 */
export async function searchStudentsForExam(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { q, group_id } = req.query;

    let sql = `
      SELECT s.id, s.student_id, s.full_name, s.name_ar, s.phone, s.gender,
             qe.group_id, qg.name as group_name, ql.name as level_name
      FROM students s
      LEFT JOIN quran_enrollments qe ON qe.student_id = s.id AND qe.status = 'active'
      LEFT JOIN quran_groups qg ON qe.group_id = qg.id
      LEFT JOIN quran_levels ql ON qg.level_id = ql.id
      WHERE s.is_active = 1
    `;
    const params = [];

    // Teacher Scoping: verify that teacher can only search students in their assigned groups
    if (currentUser.role === 'teacher') {
      sql += ` AND qe.group_id IN (SELECT group_id FROM quran_teacher_assignments WHERE teacher_id = ?)`;
      params.push(currentUser.id);
    }

    if (group_id) {
      sql += ` AND qe.group_id = ?`;
      params.push(group_id);
    }

    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      sql += ` AND (s.name_ar LIKE ? OR s.full_name LIKE ? OR s.student_id LIKE ? OR s.phone LIKE ?)`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY s.name_ar ASC, s.full_name ASC LIMIT 50`;

    const students = await query(sql, params);
    res.json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// 3. QURAN MEMORIZATION EXAMINATIONS CONTROLLERS
// ============================================================================

/**
 * List all Quran Memorization Examinations with search & filtering
 */
export async function listMemorizationExams(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { student_id, search, start_date, end_date, group_id, exam_id } = req.query;

    let sql = `
      SELECT qe.id, qe.exam_id, qe.student_id, qe.group_id, qe.exam_date, qe.start_juz, qe.end_juz,
             qe.examiner_name, qe.examiner_id, qe.maximum_marks, qe.total_deductions,
             qe.marks_obtained, qe.final_score, qe.score, qe.result, qe.notes, qe.created_at,
             s.student_id as student_code, s.full_name as student_name, s.name_ar as student_name_ar,
             qg.name as group_name,
             qx.title as exam_title,
             u.full_name as created_by_name,
             (SELECT COUNT(*) FROM quran_student_exam_errors qee WHERE qee.exam_id = qe.id) as error_count
      FROM quran_student_examinations qe
      JOIN students s ON qe.student_id = s.id
      LEFT JOIN quran_groups qg ON qe.group_id = qg.id
      LEFT JOIN quran_exams qx ON qe.exam_id = qx.id
      LEFT JOIN users u ON qe.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    // Teacher Scoping
    if (currentUser.role === 'teacher') {
      sql += ` AND (qe.created_by = ? OR qe.examiner_id = ? OR qe.group_id IN (SELECT group_id FROM quran_teacher_assignments WHERE teacher_id = ?))`;
      params.push(currentUser.id, currentUser.id, currentUser.id);
    }

    if (exam_id) {
      sql += ` AND qe.exam_id = ?`;
      params.push(exam_id);
    }

    if (student_id) {
      sql += ` AND qe.student_id = ?`;
      params.push(student_id);
    }

    if (group_id) {
      sql += ` AND qe.group_id = ?`;
      params.push(group_id);
    }

    if (start_date) {
      sql += ` AND qe.exam_date >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      sql += ` AND qe.exam_date <= ?`;
      params.push(end_date);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      sql += ` AND (s.name_ar LIKE ? OR s.full_name LIKE ? OR s.student_id LIKE ? OR qe.examiner_name LIKE ?)`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY qe.exam_date DESC, qe.id DESC`;

    const exams = await query(sql, params);

    // Attach error breakdown for each exam so multi-student sheets can display counts
    if (exams.length > 0) {
      const examIds = exams.map(e => e.id);
      const placeholders = examIds.map(() => '?').join(',');
      const allErrors = await query(
        `SELECT qee.*, qet.name as current_type_name, qet.name_ar as current_type_name_ar
         FROM quran_student_exam_errors qee
         LEFT JOIN quran_exam_error_types qet ON qee.error_type_id = qet.id
         WHERE qee.exam_id IN (${placeholders})
         ORDER BY qee.id ASC`,
        examIds
      );
      const errorMap = {};
      for (const err of allErrors) {
        if (!errorMap[err.exam_id]) errorMap[err.exam_id] = [];
        errorMap[err.exam_id].push(err);
      }
      for (const ex of exams) {
        ex.errors = errorMap[ex.id] || [];
      }
    }

    res.json({ success: true, data: exams });
  } catch (error) {
    next(error);
  }
}

/**
 * Get full examination details with recorded error breakdown
 */
export async function getMemorizationExamById(req, res, next) {
  try {
    const { id } = req.params;

    const [exam] = await query(
      `SELECT qe.*, 
              s.student_id as student_code, s.full_name as student_name, s.name_ar as student_name_ar, s.phone as student_phone,
              qg.name as group_name,
              u.full_name as created_by_name
       FROM quran_student_examinations qe
       JOIN students s ON qe.student_id = s.id
       LEFT JOIN quran_groups qg ON qe.group_id = qg.id
       LEFT JOIN users u ON qe.created_by = u.id
       WHERE qe.id = ?`,
      [id]
    );

    if (!exam) {
      return res.status(404).json({ success: false, error: 'Imtixaanka lama helin.' });
    }

    // Fetch recorded errors breakdown
    const errors = await query(
      `SELECT qee.*, qet.name as current_type_name, qet.name_ar as current_type_name_ar
       FROM quran_student_exam_errors qee
       LEFT JOIN quran_exam_error_types qet ON qee.error_type_id = qet.id
       WHERE qee.exam_id = ?
       ORDER BY qee.id ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...exam,
        errors
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Record a new Quran memorization examination with server-side error validation and scoring
 */
export async function createMemorizationExam(req, res, next) {
  try {
    const currentUser = req.session.user;
    const {
      exam_id,
      student_id,
      group_id,
      exam_date,
      start_juz,
      end_juz,
      examiner_name,
      maximum_marks,
      errors = [],
      notes,
      result
    } = req.body;

    // 1. Mandatory Fields Validation
    if (!student_id || !exam_date || start_juz === undefined || end_juz === undefined || !examiner_name) {
      return res.status(400).json({
        success: false,
        error: 'Ardayga, taariikhda, heerka Juz (bilow & dhammaad), iyo magaca imtixaamayaha waa qasab.'
      });
    }

    const sJuz = parseInt(start_juz, 10);
    const eJuz = parseInt(end_juz, 10);

    if (isNaN(sJuz) || isNaN(eJuz) || sJuz < 1 || sJuz > 30 || eJuz < 1 || eJuz > 30) {
      return res.status(400).json({ success: false, error: 'Juz-ku waa inuu u dhexeeyaa 1 ilaa 30.' });
    }

    if (sJuz > eJuz) {
      return res.status(400).json({ success: false, error: 'Juz-ka bilowgu kama weynaan karo Juz-ka dhammaadka.' });
    }

    const maxMarks = parseFloat(maximum_marks) || 100.00;
    if (maxMarks <= 0) {
      return res.status(400).json({ success: false, error: 'Dhibcaha ugu sarreeya waa inay ka weynaadaan 0.' });
    }

    // 2. Verify student exists
    const [student] = await query('SELECT * FROM students WHERE id = ? AND is_active = 1', [student_id]);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Ardayga lama helin ama ma shaqaynayo.' });
    }

    // 2.1 Duplicate Check: A student CANNOT be entered twice into the same exam session!
    if (exam_id) {
      const [existingAttempt] = await query(
        `SELECT id, final_score, result FROM quran_student_examinations WHERE exam_id = ? AND student_id = ?`,
        [exam_id, student_id]
      );
      if (existingAttempt) {
        return res.status(400).json({
          success: false,
          error: `Ardaygan (${student.full_name}) mar hore ayaa imtixaankan loogu diiwaangeliyay natiijo (${existingAttempt.final_score}% - ${existingAttempt.result || ''}). Ma bannaana in hal arday laba jeer isla imtixaankan galo.`
        });
      }
    }

    // 3. Teacher Scoping Check
    let assignedGroupId = group_id || null;
    if (currentUser.role === 'teacher') {
      const [enrollment] = await query(
        `SELECT group_id FROM quran_enrollments WHERE student_id = ? AND status = 'active'`,
        [student_id]
      );
      if (!enrollment) {
        return res.status(403).json({
          success: false,
          error: 'Ardaygan kuma qorna halaqo firfircoon oo Quraan ah.'
        });
      }
      const isAssigned = await isTeacherAssignedToGroup(currentUser.id, enrollment.group_id);
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          error: 'Uma lihid fasax inaad imtixaan ka qaaddo arday aan ku jirin halaqadahaaga.'
        });
      }
      assignedGroupId = enrollment.group_id;
    }

    // 4. Server-side Validation of Errors and Score Calculation
    // Fetch all active error types from DB to guarantee correct scoring
    const activeErrorTypes = await query('SELECT * FROM quran_exam_error_types');
    const errorTypeMap = new Map();
    activeErrorTypes.forEach(t => errorTypeMap.set(t.id, t));

    let calculatedTotalDeductions = 0.00;
    const validatedErrorEntries = [];

    if (Array.isArray(errors) && errors.length > 0) {
      for (const err of errors) {
        const typeId = parseInt(err.error_type_id, 10);
        const occurrences = parseInt(err.occurrences, 10) || 1;

        if (occurrences <= 0) {
          return res.status(400).json({ success: false, error: 'Tirada khaladaadka waa inay noqotaa 1 ama ka badan.' });
        }

        const typeConfig = errorTypeMap.get(typeId);
        if (!typeConfig) {
          return res.status(400).json({ success: false, error: `Nooca khaladka (#${typeId}) ma jiro.` });
        }

        const unitDeduction = parseFloat(typeConfig.deduction_points);
        const itemTotalDeduction = Math.round(unitDeduction * occurrences * 100) / 100;
        calculatedTotalDeductions += itemTotalDeduction;

        validatedErrorEntries.push({
          error_type_id: typeConfig.id,
          error_name: typeConfig.name,
          error_name_ar: typeConfig.name_ar,
          severity: typeConfig.severity,
          deduction_per_unit: unitDeduction,
          occurrences,
          total_deduction: itemTotalDeduction,
          notes: err.notes ? err.notes.trim() : null
        });
      }
    }

    calculatedTotalDeductions = Math.round(calculatedTotalDeductions * 100) / 100;

    // Final score formula: Final score = Maximum score − Total deductions
    // Clamped so score cannot be negative
    const calculatedFinalScore = Math.max(0, Math.round((maxMarks - calculatedTotalDeductions) * 100) / 100);

    // Dynamic result designation
    let finalResultLabel = result;
    if (!finalResultLabel) {
      const percentage = (calculatedFinalScore / maxMarks) * 100;
      if (percentage >= 90) finalResultLabel = 'Mumtaz (ممتاز)';
      else if (percentage >= 80) finalResultLabel = 'Jayyid Jiddan (جيد جداً)';
      else if (percentage >= 65) finalResultLabel = 'Jayyid (جيد)';
      else if (percentage >= 50) finalResultLabel = 'Maqbul (مقبول)';
      else finalResultLabel = 'Daeef / Haray (ضعيف)';
    }

    let createdExamId = null;

    // 5. Save with Database Transaction
    await withTransaction(async (conn) => {
      // Insert Exam Record
      const [examInsert] = await conn.execute(
        `INSERT INTO quran_student_examinations 
         (exam_id, student_id, group_id, exam_date, start_juz, end_juz, examiner_name, examiner_id,
          maximum_marks, total_deductions, marks_obtained, final_score, score, result, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          exam_id || null,
          student_id,
          assignedGroupId,
          exam_date,
          sJuz,
          eJuz,
          examiner_name.trim(),
          currentUser.id,
          maxMarks,
          calculatedTotalDeductions,
          calculatedFinalScore,
          calculatedFinalScore,
          calculatedFinalScore,
          finalResultLabel,
          notes ? notes.trim() : null,
          currentUser.id
        ]
      );

      createdExamId = examInsert.insertId;

      // Insert Snapshot of Recorded Errors
      for (const entry of validatedErrorEntries) {
        await conn.execute(
          `INSERT INTO quran_student_exam_errors 
           (exam_id, error_type_id, error_name, error_name_ar, severity, deduction_per_unit, occurrences, total_deduction, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            createdExamId,
            entry.error_type_id,
            entry.error_name,
            entry.error_name_ar,
            entry.severity,
            entry.deduction_per_unit,
            entry.occurrences,
            entry.total_deduction,
            entry.notes
          ]
        );
      }
    });

    await logAudit({
      userId: currentUser.id,
      action: 'RECORD_QURAN_MEMORIZATION_EXAM',
      module: 'quran_exams',
      division: 'quran',
      recordId: createdExamId,
      details: `Recorded Quran exam for student ${student.full_name} (${student.name_ar || ''}) Juz ${sJuz}-${eJuz}. Score: ${calculatedFinalScore}/${maxMarks} (Deductions: ${calculatedTotalDeductions})`,
      afterValue: {
        exam_id: createdExamId,
        student_id,
        juz_range: `${sJuz}-${eJuz}`,
        maximum_marks: maxMarks,
        total_deductions: calculatedTotalDeductions,
        final_score: calculatedFinalScore,
        error_count: validatedErrorEntries.length
      },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Imtixaanka Quraanka si guul leh ayaa loo diiwaangeliyay.',
      data: {
        id: createdExamId,
        final_score: calculatedFinalScore,
        total_deductions: calculatedTotalDeductions,
        maximum_marks: maxMarks,
        result: finalResultLabel
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update/Correct an examination (Authorized Admins only) with audit logging
 */
export async function updateMemorizationExam(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { id } = req.params;
    const {
      exam_date,
      start_juz,
      end_juz,
      examiner_name,
      maximum_marks,
      errors = [],
      notes,
      result
    } = req.body;

    const [existing] = await query('SELECT * FROM quran_student_examinations WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Imtixaanka lama helin.' });
    }

    const sJuz = start_juz !== undefined ? parseInt(start_juz, 10) : existing.start_juz;
    const eJuz = end_juz !== undefined ? parseInt(end_juz, 10) : existing.end_juz;

    if (sJuz < 1 || sJuz > 30 || eJuz < 1 || eJuz > 30 || sJuz > eJuz) {
      return res.status(400).json({ success: false, error: 'Juz-ka bilowga iyo dhammaadka sax ma aha.' });
    }

    const maxMarks = maximum_marks !== undefined ? parseFloat(maximum_marks) : parseFloat(existing.maximum_marks);

    // Fetch active error types
    const activeErrorTypes = await query('SELECT * FROM quran_exam_error_types');
    const errorTypeMap = new Map();
    activeErrorTypes.forEach(t => errorTypeMap.set(t.id, t));

    let calculatedTotalDeductions = 0.00;
    const validatedErrorEntries = [];

    if (Array.isArray(errors)) {
      for (const err of errors) {
        const typeId = parseInt(err.error_type_id, 10);
        const occurrences = parseInt(err.occurrences, 10) || 1;
        const typeConfig = errorTypeMap.get(typeId);

        if (typeConfig) {
          const unitDeduction = parseFloat(typeConfig.deduction_points);
          const itemTotalDeduction = Math.round(unitDeduction * occurrences * 100) / 100;
          calculatedTotalDeductions += itemTotalDeduction;

          validatedErrorEntries.push({
            error_type_id: typeConfig.id,
            error_name: typeConfig.name,
            error_name_ar: typeConfig.name_ar,
            severity: typeConfig.severity,
            deduction_per_unit: unitDeduction,
            occurrences,
            total_deduction: itemTotalDeduction,
            notes: err.notes ? err.notes.trim() : null
          });
        }
      }
    }

    calculatedTotalDeductions = Math.round(calculatedTotalDeductions * 100) / 100;
    const calculatedFinalScore = Math.max(0, Math.round((maxMarks - calculatedTotalDeductions) * 100) / 100);

    let finalResultLabel = result || existing.result;

    await withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE quran_student_examinations 
         SET exam_date = ?, start_juz = ?, end_juz = ?, examiner_name = ?,
             maximum_marks = ?, total_deductions = ?, marks_obtained = ?, final_score = ?, score = ?,
             result = ?, notes = ?, updated_by = ?
         WHERE id = ?`,
        [
          exam_date || existing.exam_date,
          sJuz,
          eJuz,
          examiner_name ? examiner_name.trim() : existing.examiner_name,
          maxMarks,
          calculatedTotalDeductions,
          calculatedFinalScore,
          calculatedFinalScore,
          calculatedFinalScore,
          finalResultLabel,
          notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
          currentUser.id,
          id
        ]
      );

      // Re-populate errors
      await conn.execute('DELETE FROM quran_student_exam_errors WHERE exam_id = ?', [id]);
      for (const entry of validatedErrorEntries) {
        await conn.execute(
          `INSERT INTO quran_student_exam_errors 
           (exam_id, error_type_id, error_name, error_name_ar, severity, deduction_per_unit, occurrences, total_deduction, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            entry.error_type_id,
            entry.error_name,
            entry.error_name_ar,
            entry.severity,
            entry.deduction_per_unit,
            entry.occurrences,
            entry.total_deduction,
            entry.notes
          ]
        );
      }
    });

    await logAudit({
      userId: currentUser.id,
      action: 'UPDATE_QURAN_MEMORIZATION_EXAM',
      module: 'quran_exams',
      division: 'quran',
      recordId: id,
      details: `Updated Quran exam #${id}. Recalculated score: ${calculatedFinalScore}/${maxMarks} (Deductions: ${calculatedTotalDeductions})`,
      beforeValue: { final_score: existing.final_score, total_deductions: existing.total_deductions },
      afterValue: { final_score: calculatedFinalScore, total_deductions: calculatedTotalDeductions },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Imtixaanka ardayga si guul leh ayaa loo cusbooneysiiyay.',
      data: {
        id,
        final_score: calculatedFinalScore,
        total_deductions: calculatedTotalDeductions
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Permanently delete a single Quran memorization exam result
 */
export async function deleteMemorizationExam(req, res, next) {
  try {
    const { id } = req.params;
    const currentUser = req.session.user;

    const [exam] = await query(
      `SELECT qe.*, s.full_name as student_name, s.student_id as student_code 
       FROM quran_student_examinations qe
       JOIN students s ON qe.student_id = s.id
       WHERE qe.id = ?`,
      [id]
    );

    if (!exam) {
      return res.status(404).json({ success: false, error: 'Diiwaanka imtixaanka lama helin.' });
    }

    await withTransaction(async (conn) => {
      await conn.execute(`DELETE FROM quran_student_exam_errors WHERE exam_id = ?`, [id]);
      await conn.execute(`DELETE FROM quran_student_examinations WHERE id = ?`, [id]);
    });

    await logAudit({
      userId: currentUser.id,
      action: 'DELETE_MEMORIZATION_EXAM',
      module: 'quran_exams',
      division: 'quran',
      recordId: id,
      details: `Deleted Quran exam result #${id} for student ${exam.student_name} (${exam.student_code})`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Natiijada imtixaanka ee ardayga ${exam.student_name} si guul leh ayaa loo tirtiray.`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all Quran Exam Sessions (Kalka Imtixaanka)
 */
export async function listQuranExamSessions(req, res, next) {
  try {
    const { group_id } = req.query;
    let sql = `
      SELECT qe.id, qe.title, qe.academic_year, qe.group_id, qe.exam_date, qe.maximum_marks, qe.status,
             qe.created_at, qg.name as group_name,
             u.full_name as created_by_name,
             (SELECT COUNT(*) FROM quran_student_examinations qse WHERE qse.exam_id = qe.id) as student_count,
             (SELECT AVG(qse.final_score) FROM quran_student_examinations qse WHERE qse.exam_id = qe.id) as avg_score
      FROM quran_exams qe
      LEFT JOIN quran_groups qg ON qe.group_id = qg.id
      LEFT JOIN users u ON qe.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (group_id) {
      sql += ` AND (qe.group_id = ? OR qe.group_id IS NULL)`;
      params.push(group_id);
    }
    sql += ` ORDER BY qe.exam_date DESC, qe.id DESC`;

    const sessions = await query(sql, params);
    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new Quran Exam Session (Menu: Abuur Imtixaan)
 */
export async function createQuranExamSession(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { title, exam_date, group_id, maximum_marks } = req.body;

    if (!title || !title.trim() || !exam_date) {
      return res.status(400).json({
        success: false,
        error: 'Magaca imtixaanka iyo taariikhda waa qasab.'
      });
    }

    const maxMarks = parseFloat(maximum_marks) || 100.00;
    const groupId = group_id ? parseInt(group_id, 10) : null;

    const result = await query(
      `INSERT INTO quran_exams (title, group_id, exam_date, maximum_marks, status, created_by)
       VALUES (?, ?, ?, ?, 'published', ?)`,
      [title.trim(), groupId, exam_date, maxMarks, currentUser.id]
    );

    await logAudit({
      userId: currentUser.id,
      action: 'CREATE_QURAN_EXAM_SESSION',
      module: 'quran_exams',
      division: 'quran',
      recordId: result.insertId,
      details: `Created Quran Exam Session #${result.insertId} ("${title.trim()}") on ${exam_date}`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      data: { id: result.insertId, title: title.trim(), exam_date, group_id: groupId },
      message: `Imtixaanka "${title.trim()}" si guul leh ayaa loo abuuray.`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a Quran Exam Session and all associated student examinations & error breakdown
 */
export async function deleteQuranExamSession(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { id } = req.params;

    const [session] = await query('SELECT * FROM quran_exams WHERE id = ?', [id]);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Kalka imtixaanka lama helin.' });
    }

    await withTransaction(async (conn) => {
      // 1. Delete error records for all student examinations in this exam session
      await conn.execute(
        `DELETE qee FROM quran_student_exam_errors qee
         JOIN quran_student_examinations qse ON qee.exam_id = qse.id
         WHERE qse.exam_id = ?`,
        [id]
      );

      // 2. Delete student examinations
      await conn.execute(`DELETE FROM quran_student_examinations WHERE exam_id = ?`, [id]);

      // 3. Delete marks from quran_exam_marks if any
      await conn.execute(`DELETE FROM quran_exam_marks WHERE exam_id = ?`, [id]);

      // 4. Finally delete the exam session
      await conn.execute(`DELETE FROM quran_exams WHERE id = ?`, [id]);
    });

    await logAudit({
      userId: currentUser.id,
      action: 'DELETE_QURAN_EXAM_SESSION',
      module: 'quran_exams',
      division: 'quran',
      recordId: id,
      details: `Permanently deleted Quran Exam Session #${id} ("${session.title}")`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Imtixaanka "${session.title}" iyo dhammaan natiijooyinka ku jiray si joogto ah ayaa loo tirtiray.`
    });
  } catch (error) {
    next(error);
  }
}

