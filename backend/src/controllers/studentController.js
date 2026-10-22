import { query, withTransaction } from '../db/connection.js';
import { logAudit } from '../services/auditService.js';

/**
 * List students with filters, search, and division scoping
 */
export async function listStudents(req, res, next) {
  try {
    const user = req.session.user;
    const { search, division, class_id, group_id, status } = req.query;

    let sql = `
      SELECT DISTINCT s.id, s.student_id, s.full_name, s.name_ar, s.gender, s.phone,
             s.guardian_name, s.guardian_phone, s.address, s.is_active, s.created_at,
             ie.class_id as institute_class_id, ic.name as institute_class_name,
             qe.group_id as quran_group_id, qg.name as quran_group_name
      FROM students s
      LEFT JOIN institute_enrollments ie ON s.id = ie.student_id AND ie.status = 'active'
      LEFT JOIN institute_classes ic ON ie.class_id = ic.id
      LEFT JOIN quran_enrollments qe ON s.id = qe.student_id AND qe.status = 'active'
      LEFT JOIN quran_groups qg ON qe.group_id = qg.id
      WHERE 1=1
    `;
    const params = [];

    // Division scope enforcement
    if (user.role === 'institute_admin' || user.division_scope === 'institute') {
      sql += ` AND ie.id IS NOT NULL`;
    } else if (user.role === 'quran_admin' || user.division_scope === 'quran') {
      sql += ` AND qe.id IS NOT NULL`;
    } else if (division === 'institute') {
      sql += ` AND ie.id IS NOT NULL`;
    } else if (division === 'quran') {
      sql += ` AND qe.id IS NOT NULL`;
    }

    if (search) {
      const searchTerm = `%${search.trim()}%`;
      sql += ` AND (s.full_name LIKE ? OR s.name_ar LIKE ? OR s.student_id LIKE ? OR s.phone LIKE ? OR s.guardian_phone LIKE ?)`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (class_id) {
      sql += ` AND ie.class_id = ?`;
      params.push(class_id);
    }

    if (group_id) {
      sql += ` AND qe.group_id = ?`;
      params.push(group_id);
    }

    if (status !== undefined && status !== '' && status !== 'all') {
      sql += ` AND s.is_active = ?`;
      params.push(status === 'active' || status === '1' || status === true ? 1 : 0);
    } else if (status === undefined || status === '') {
      sql += ` AND s.is_active = 1`;
    }

    sql += ` ORDER BY s.id DESC LIMIT 200`;

    const students = await query(sql, params);
    res.json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single student by ID with enrollments and financial summary
 */
export async function getStudentById(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.session.user;

    const [student] = await query(`SELECT * FROM students WHERE id = ?`, [id]);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Ardayga lama helin.' });
    }

    // Get institute enrollments
    const instituteEnrollments = await query(
      `SELECT ie.*, ic.name as class_name, ic.academic_year
       FROM institute_enrollments ie
       JOIN institute_classes ic ON ie.class_id = ic.id
       WHERE ie.student_id = ?`,
      [id]
    );

    // Get quran enrollments
    const quranEnrollments = await query(
      `SELECT qe.*, qg.name as group_name, qg.shift, ql.name as level_name
       FROM quran_enrollments qe
       JOIN quran_groups qg ON qe.group_id = qg.id
       LEFT JOIN quran_levels ql ON qg.level_id = ql.id
       WHERE qe.student_id = ?`,
      [id]
    );

    // Scope check: If user is institute-scoped, student must have institute enrollment
    if (user.role === 'institute_admin' || user.division_scope === 'institute') {
      if (instituteEnrollments.length === 0) {
        return res.status(403).json({ success: false, error: 'Ma lihid fasax aad ku aragto ardaygan.' });
      }
    } else if (user.role === 'quran_admin' || user.division_scope === 'quran') {
      if (quranEnrollments.length === 0) {
        return res.status(403).json({ success: false, error: 'Ma lihid fasax aad ku aragto ardaygan.' });
      }
    } else if (user.role === 'teacher') {
      const [instituteAccess] = await query(`
        SELECT ie.id
        FROM institute_enrollments ie
        JOIN institute_teacher_assignments ita ON ita.class_id = ie.class_id
        WHERE ie.student_id = ? AND ie.status = 'active' AND ita.teacher_id = ?
        LIMIT 1
      `, [id, user.id]);
      const [quranAccess] = await query(`
        SELECT qe.id
        FROM quran_enrollments qe
        JOIN quran_teacher_assignments qta ON qta.group_id = qe.group_id
        WHERE qe.student_id = ? AND qe.status = 'active' AND qta.teacher_id = ?
        LIMIT 1
      `, [id, user.id]);
      if (!instituteAccess && !quranAccess) {
        return res.status(403).json({ success: false, error: 'Ma lihid fasax aad ku aragto ardaygan.' });
      }
    }

    // Get fee invoices
    const invoices = await query(
      `SELECT * FROM fee_invoices WHERE student_id = ? ORDER BY id DESC`,
      [id]
    );

    // Get payments
    const payments = await query(
      `SELECT p.*, u.full_name as received_by_name 
       FROM payments p
       JOIN users u ON p.received_by = u.id
       WHERE p.student_id = ? ORDER BY p.id DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...student,
        institute_enrollments: instituteEnrollments,
        quran_enrollments: quranEnrollments,
        invoices,
        payments
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create new student and enroll in Institute, Quran, or both
 */
export async function createStudent(req, res, next) {
  try {
    const user = req.session.user;
    const {
      full_name,
      name_ar,
      gender,
      phone,
      guardian_name,
      guardian_phone,
      guardian_relationship,
      address,
      notes,
      enroll_institute,
      institute_class_id,
      enroll_quran,
      quran_group_id
    } = req.body;

    const resolvedName = (name_ar || full_name || '').trim();
    if (!resolvedName) {
      return res.status(400).json({
        success: false,
        error: 'Magaca ardayga ee Carabiga waa qasab (Student Arabic name is required).'
      });
    }

    const resolvedPhone = (guardian_phone || phone || '').trim();
    if (!resolvedPhone) {
      return res.status(400).json({
        success: false,
        error: 'Taleefanka waalidka/masuulka waa qasab (Parent/Guardian phone is required).'
      });
    }

    // Scope enforcement for enrollment
    if (enroll_institute && (user.role === 'quran_admin' || user.division_scope === 'quran')) {
      return res.status(403).json({
        success: false,
        error: 'Maamulaha Quraanku ma diiwaangelin karo ardayda Machadka.'
      });
    }

    if (enroll_quran && (user.role === 'institute_admin' || user.division_scope === 'institute')) {
      return res.status(403).json({
        success: false,
        error: 'Maamulaha Machadku ma diiwaangelin karo ardayda Dugsiga Quraanka.'
      });
    }

    const result = await withTransaction(async (conn) => {
      // Generate unique student ID (STU-YYYY-XXXX)
      const currentYear = new Date().getFullYear();
      const [[{ count }]] = await conn.execute(
        `SELECT COUNT(*) as count FROM students WHERE student_id LIKE ?`,
        [`STU-${currentYear}-%`]
      );
      const studentIdCode = `STU-${currentYear}-${String(count + 1).padStart(3, '0')}`;

      // Insert student with Arabic name as primary
      const [insertRes] = await conn.execute(
        `INSERT INTO students (student_id, full_name, name_ar, gender, phone, guardian_name, guardian_phone, guardian_relationship, address, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          studentIdCode,
          resolvedName,
          name_ar ? name_ar.trim() : resolvedName,
          gender || 'male',
          resolvedPhone || null,
          guardian_name ? guardian_name.trim() : null,
          resolvedPhone || null,
          guardian_relationship || null,
          address || null,
          notes || null,
          user.id
        ]
      );
      const studentDbId = insertRes.insertId;

      // Enroll in Institute if requested
      if (enroll_institute && institute_class_id) {
        await conn.execute(
          `INSERT INTO institute_enrollments (student_id, class_id, enrollment_date, status)
           VALUES (?, ?, CURDATE(), 'active')`,
          [studentDbId, institute_class_id]
        );
      }

      // Enroll in Quran if requested
      if (enroll_quran && quran_group_id) {
        await conn.execute(
          `INSERT INTO quran_enrollments (student_id, group_id, enrollment_date, status)
           VALUES (?, ?, CURDATE(), 'active')`,
          [studentDbId, quran_group_id]
        );
      }

      return { studentDbId, studentIdCode };
    });

    await logAudit({
      userId: user.id,
      action: 'CREATE_STUDENT',
      module: 'students',
      division: enroll_institute && enroll_quran ? 'system' : enroll_institute ? 'institute' : 'quran',
      recordId: result.studentDbId,
      details: `Created student ${full_name} (${result.studentIdCode})`,
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Ardayga si guul leh ayaa loo diiwaangeliyay.',
      student: {
        id: result.studentDbId,
        student_id: result.studentIdCode,
        full_name
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update student profile and enrollments
 */
export async function updateStudent(req, res, next) {
  try {
    const user = req.session.user;
    const { id } = req.params;
    const {
      full_name,
      name_ar,
      gender,
      phone,
      guardian_name,
      guardian_phone,
      guardian_relationship,
      address,
      notes,
      is_active,
      institute_class_id,
      quran_group_id
    } = req.body;

    const [student] = await query(`SELECT * FROM students WHERE id = ?`, [id]);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Ardayga lama helin.' });
    }

    await withTransaction(async (conn) => {
      const resolvedName = (name_ar || full_name || '').trim();
      const resolvedPhone = (guardian_phone || phone || '').trim();

      await conn.execute(
        `UPDATE students
         SET full_name = ?, name_ar = ?, gender = ?, phone = ?, guardian_name = ?, guardian_phone = ?,
             guardian_relationship = ?, address = ?, notes = ?, is_active = ?
         WHERE id = ?`,
        [
          resolvedName || student.full_name,
          name_ar ? name_ar.trim() : (resolvedName || student.name_ar),
          gender || student.gender,
          resolvedPhone || student.phone,
          guardian_name !== undefined ? (guardian_name ? guardian_name.trim() : null) : student.guardian_name,
          resolvedPhone || student.guardian_phone,
          guardian_relationship !== undefined ? guardian_relationship : student.guardian_relationship,
          address !== undefined ? (address ? address.trim() : null) : student.address,
          notes !== undefined ? (notes ? notes.trim() : null) : student.notes,
          typeof is_active === 'boolean' ? is_active : student.is_active,
          id
        ]
      );

      // Handle Institute class update if authorized
      if (institute_class_id !== undefined && (user.role === 'super_admin' || user.division_scope === 'institute' || user.role === 'institute_admin')) {
        if (institute_class_id) {
          await conn.execute(
            `DELETE FROM institute_enrollments WHERE student_id = ? AND class_id != ?`,
            [id, institute_class_id]
          );
          const [exist] = await conn.execute(
            `SELECT id FROM institute_enrollments WHERE student_id = ? AND class_id = ?`,
            [id, institute_class_id]
          );
          if (exist.length > 0) {
            await conn.execute(
              `UPDATE institute_enrollments SET status = 'active' WHERE id = ?`,
              [exist[0].id]
            );
          } else {
            await conn.execute(
              `INSERT INTO institute_enrollments (student_id, class_id, enrollment_date, status)
               VALUES (?, ?, CURDATE(), 'active')`,
              [id, institute_class_id]
            );
          }
        }
      }

      // Handle Quran group update if authorized
      if (quran_group_id !== undefined && (user.role === 'super_admin' || user.division_scope === 'quran' || user.role === 'quran_admin')) {
        if (quran_group_id) {
          await conn.execute(
            `DELETE FROM quran_enrollments WHERE student_id = ? AND group_id != ?`,
            [id, quran_group_id]
          );
          const [exist] = await conn.execute(
            `SELECT id FROM quran_enrollments WHERE student_id = ? AND group_id = ?`,
            [id, quran_group_id]
          );
          if (exist.length > 0) {
            await conn.execute(
              `UPDATE quran_enrollments SET status = 'active' WHERE id = ?`,
              [exist[0].id]
            );
          } else {
            await conn.execute(
              `INSERT INTO quran_enrollments (student_id, group_id, enrollment_date, status)
               VALUES (?, ?, CURDATE(), 'active')`,
              [id, quran_group_id]
            );
          }
        }
      }
    });

    await logAudit({
      userId: user.id,
      action: 'UPDATE_STUDENT',
      module: 'students',
      recordId: id,
      details: `Updated student ${student.student_id} (${student.full_name})`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Xogta ardayga si guul leh ayaa loo cusbooneysiiyay.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Permanently delete a student and all associated records in database transaction
 */
export async function deleteStudent(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.session.user;

    const [student] = await query('SELECT * FROM students WHERE id = ?', [id]);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Ardayga lama helin.' });
    }

    await withTransaction(async (conn) => {
      // 1. Fee invoice items and invoices
      await conn.execute(
        `DELETE fii FROM fee_invoice_items fii 
         JOIN fee_invoices fi ON fii.invoice_id = fi.id 
         WHERE fi.student_id = ?`,
        [id]
      );
      await conn.execute(`DELETE FROM fee_invoices WHERE student_id = ?`, [id]);
      await conn.execute(`DELETE FROM payments WHERE student_id = ?`, [id]);
      await conn.execute(`DELETE FROM student_discounts WHERE student_id = ?`, [id]);
      await conn.execute(`DELETE FROM student_promotion_history WHERE student_id = ?`, [id]);

      // 2. Institute attendance, exam marks, enrollments
      await conn.execute(`DELETE FROM institute_attendance WHERE student_id = ?`, [id]);
      await conn.execute(`DELETE FROM institute_exam_marks WHERE student_id = ?`, [id]);
      await conn.execute(`DELETE FROM institute_enrollments WHERE student_id = ?`, [id]);

      // 3. Quran attendance, certificates, enrollments, exam marks, progress
      await conn.execute(`DELETE FROM quran_attendance WHERE student_id = ?`, [id]);
      await conn.execute(`DELETE FROM quran_certificates WHERE student_id = ?`, [id]);
      await conn.execute(`DELETE FROM quran_enrollments WHERE student_id = ?`, [id]);
      await conn.execute(`DELETE FROM quran_exam_marks WHERE student_id = ?`, [id]);
      await conn.execute(`DELETE FROM quran_progress WHERE student_id = ?`, [id]);

      // 4. Quran student examinations & errors
      await conn.execute(
        `DELETE qee FROM quran_student_exam_errors qee 
         JOIN quran_student_examinations qse ON qee.exam_id = qse.id 
         WHERE qse.student_id = ?`,
        [id]
      );
      await conn.execute(`DELETE FROM quran_student_examinations WHERE student_id = ?`, [id]);
      await conn.execute(`DELETE FROM quran_student_transfer_history WHERE student_id = ?`, [id]);
      await conn.execute(`DELETE FROM quran_verse_memorization WHERE student_id = ?`, [id]);

      // 5. Finally delete student record
      await conn.execute(`DELETE FROM students WHERE id = ?`, [id]);
    });

    await logAudit({
      userId: user.id,
      action: 'DELETE_STUDENT',
      module: 'students',
      recordId: id,
      details: `Permanently deleted student ${student.student_id} (${student.full_name}) and all associated records`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Ardayga ${student.full_name} (${student.student_id}) iyo dhammaan xogtiisa si joogto ah ayaa loo tirtiray.`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Archive or Restore a student (toggle is_active: 0 = archived, 1 = active)
 */
export async function archiveStudent(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.session.user;

    const [student] = await query('SELECT * FROM students WHERE id = ?', [id]);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Ardayga lama helin.' });
    }

    const newStatus = student.is_active ? 0 : 1;
    await query('UPDATE students SET is_active = ? WHERE id = ?', [newStatus, id]);

    await logAudit({
      userId: user.id,
      action: newStatus === 0 ? 'ARCHIVE_STUDENT' : 'UNARCHIVE_STUDENT',
      module: 'students',
      recordId: id,
      details: `${newStatus === 0 ? 'Archived' : 'Restored'} student ${student.student_id} (${student.full_name})`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      is_active: newStatus,
      message: newStatus === 0
        ? `Ardayga ${student.full_name} waa la xareeyay (Archived). Liiska firfircoon kuma soo baxayo, laakiin warbixinada (Reports) xogtiisu way ku jirtaa.`
        : `Ardayga ${student.full_name} dib ayaa loo soo celiyay (Restored / Active).`
    });
  } catch (error) {
    next(error);
  }
}

