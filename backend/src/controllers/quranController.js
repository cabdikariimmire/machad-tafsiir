import { query, withTransaction } from '../db/connection.js';
import { logAudit } from '../services/auditService.js';
import * as quranService from '../services/quranService.js';

// Levels
export async function getLevels(req, res, next) {
  try {
    const levels = await query(`SELECT * FROM quran_levels ORDER BY id ASC`);
    res.json({ success: true, data: levels });
  } catch (error) {
    next(error);
  }
}

export async function createLevel(req, res, next) {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Magaca heerka (level) waa qasab.' });
    }
    const result = await query(
      `INSERT INTO quran_levels (name, description) VALUES (?, ?)`,
      [name.trim(), description || null]
    );
    res.status(201).json({ success: true, message: 'Heerka Quraanka waa la abuuray.', id: result.insertId });
  } catch (error) {
    next(error);
  }
}

// Groups (Quran School Classes / Halaqaat)
export async function getGroups(req, res, next) {
  try {
    const user = req.session.user;

    // Strict Teacher Scoping: Teachers see ONLY their assigned classes/groups
    if (user.role === 'teacher') {
      const groups = await quranService.getTeacherGroups(user.id);
      return res.json({ success: true, data: groups });
    }

    const groups = await query(`
      SELECT qg.*, ql.name as level_name,
             (SELECT COUNT(*) FROM quran_enrollments qe WHERE qe.group_id = qg.id AND qe.status = 'active') as student_count,
             qta.teacher_id as assigned_teacher_id,
             u.full_name as assigned_teachers,
             u.full_name as assigned_teacher_name,
             u.phone as assigned_teacher_phone
      FROM quran_groups qg
      LEFT JOIN quran_levels ql ON qg.level_id = ql.id
      LEFT JOIN quran_teacher_assignments qta ON qta.group_id = qg.id
      LEFT JOIN users u ON qta.teacher_id = u.id
      ORDER BY qg.id ASC
    `);
    res.json({ success: true, data: groups });
  } catch (error) {
    next(error);
  }
}

export async function createGroup(req, res, next) {
  try {
    const { level_id, name, shift, teacher_id } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Magaca fasalka/halaqada waa qasab.' });
    }

    // Validate schedule: Subax, Galab, Subax iyo Galab
    let normalizedShift = 'Subax';
    if (shift === 'Galab' || shift === 'afternoon') normalizedShift = 'Galab';
    else if (shift === 'Subax iyo Galab' || shift === 'morning_afternoon') normalizedShift = 'Subax iyo Galab';
    else if (shift === 'Subax' || shift === 'morning') normalizedShift = 'Subax';
    else if (shift) normalizedShift = shift;

    if (!teacher_id) {
      return res.status(400).json({ success: false, error: 'Fadlan xilsaar hal macallin fasalkan.' });
    }

    const result = await withTransaction(async (conn) => {
      const [insertRes] = await conn.execute(
        `INSERT INTO quran_groups (level_id, name, shift, is_active) VALUES (?, ?, ?, 1)`,
        [level_id || null, name.trim(), normalizedShift]
      );
      const groupId = insertRes.insertId;

      // Assign exactly one teacher to this class
      await conn.execute(
        `INSERT INTO quran_teacher_assignments (teacher_id, group_id) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE teacher_id = VALUES(teacher_id)`,
        [teacher_id, groupId]
      );

      return groupId;
    });

    await logAudit({
      userId: req.session.user.id,
      action: 'CREATE_QURAN_CLASS',
      module: 'quran_groups',
      division: 'quran',
      recordId: result,
      details: `Created Quran class "${name.trim()}" with schedule ${normalizedShift} and teacher ID ${teacher_id}`
    });

    res.status(201).json({ success: true, message: 'Fasalka Quraanka si guul leh ayaa loo abuuray.', id: result });
  } catch (error) {
    next(error);
  }
}

export async function updateGroup(req, res, next) {
  try {
    const { id } = req.params;
    const { level_id, name, shift, teacher_id, is_active } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Magaca fasalka/halaqada waa qasab.' });
    }

    let normalizedShift = 'Subax';
    if (shift === 'Galab' || shift === 'afternoon') normalizedShift = 'Galab';
    else if (shift === 'Subax iyo Galab' || shift === 'morning_afternoon') normalizedShift = 'Subax iyo Galab';
    else if (shift === 'Subax' || shift === 'morning') normalizedShift = 'Subax';
    else if (shift) normalizedShift = shift;

    await withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE quran_groups SET level_id = ?, name = ?, shift = ?, is_active = ? WHERE id = ?`,
        [level_id || null, name.trim(), normalizedShift, is_active !== undefined ? (is_active ? 1 : 0) : 1, id]
      );

      if (teacher_id) {
        // Enforce exactly one teacher assigned to this class
        await conn.execute(
          `DELETE FROM quran_teacher_assignments WHERE group_id = ?`,
          [id]
        );
        await conn.execute(
          `INSERT INTO quran_teacher_assignments (teacher_id, group_id) VALUES (?, ?)`,
          [teacher_id, id]
        );
      }
    });

    await logAudit({
      userId: req.session.user.id,
      action: 'UPDATE_QURAN_CLASS',
      module: 'quran_groups',
      division: 'quran',
      recordId: id,
      details: `Updated Quran class #${id} ("${name.trim()}")`
    });

    res.json({ success: true, message: 'Fasalka Quraanka waa la cusbooneysiiyay.' });
  } catch (error) {
    next(error);
  }
}

export async function deleteGroup(req, res, next) {
  try {
    const { id } = req.params;

    // Check if class has active students
    const [enrollment] = await query(
      `SELECT COUNT(*) as count FROM quran_enrollments WHERE group_id = ? AND status = 'active'`,
      [id]
    );

    if (enrollment && enrollment.count > 0) {
      return res.status(400).json({
        success: false,
        error: `Fasalkan lama tiri karo maxaa yeelay waxaa ku jira ${enrollment.count} arday oo firfircoon. Fadlan ardayda wareeji ka hor inta aanad tirin.`
      });
    }

    await withTransaction(async (conn) => {
      await conn.execute(`DELETE FROM quran_teacher_assignments WHERE group_id = ?`, [id]);
      await conn.execute(`DELETE FROM quran_groups WHERE id = ?`, [id]);
    });

    res.json({ success: true, message: 'Fasalka si guul leh ayaa loo tiray.' });
  } catch (error) {
    next(error);
  }
}

export async function getGroupStudents(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.session.user;

    // Strict Teacher Scoping: Verify that teacher is assigned to this group
    if (user.role === 'teacher') {
      const isAssigned = await quranService.isTeacherAssignedToGroup(user.id, id);
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          error: 'Ma lihid ogolaansho aad ku aragto fasalkan/halaqadan.'
        });
      }
    }

    const students = await query(`
      SELECT s.id, s.student_id, s.full_name, s.name_ar, s.phone, s.gender, qe.enrollment_date, qe.status,
             (SELECT COUNT(*) FROM quran_verse_memorization qvm WHERE qvm.student_id = s.id AND qvm.is_memorized = 1) as memorized_verses_count
      FROM quran_enrollments qe
      JOIN students s ON qe.student_id = s.id
      WHERE qe.group_id = ? AND qe.status = 'active' AND s.is_active = 1
      ORDER BY s.full_name ASC
    `, [id]);
    res.json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
}

// Register a new student directly through the class workflow
export async function registerStudentToGroup(req, res, next) {
  try {
    const { id } = req.params; // group_id
    const user = req.session.user;
    const {
      full_name,
      name_ar,
      gender,
      phone,
      guardian_name,
      guardian_phone
    } = req.body;

    if (!full_name || !full_name.trim() || !phone || !phone.trim()) {
      return res.status(400).json({ success: false, error: 'Magaca ardayga iyo taleefanka waa qasab.' });
    }

    const [group] = await query(`SELECT id, name FROM quran_groups WHERE id = ?`, [id]);
    if (!group) {
      return res.status(404).json({ success: false, error: 'Fasalka lama helin.' });
    }

    const result = await withTransaction(async (conn) => {
      const currentYear = new Date().getFullYear();
      const [[{ count }]] = await conn.execute(
        `SELECT COUNT(*) as count FROM students WHERE student_id LIKE ?`,
        [`STU-${currentYear}-%`]
      );
      const studentIdCode = `STU-${currentYear}-${String(count + 1).padStart(3, '0')}`;

      const [insertRes] = await conn.execute(
        `INSERT INTO students (student_id, full_name, name_ar, gender, phone, guardian_name, guardian_phone, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          studentIdCode,
          full_name.trim(),
          name_ar ? name_ar.trim() : null,
          gender || 'male',
          phone.trim(),
          guardian_name ? guardian_name.trim() : null,
          guardian_phone ? guardian_phone.trim() : null,
          user.id
        ]
      );
      const studentDbId = insertRes.insertId;

      await conn.execute(
        `INSERT INTO quran_enrollments (student_id, group_id, enrollment_date, status)
         VALUES (?, ?, CURDATE(), 'active')`,
        [studentDbId, id]
      );

      return { studentDbId, studentIdCode };
    });

    await logAudit({
      userId: user.id,
      action: 'REGISTER_STUDENT_TO_QURAN_GROUP',
      module: 'quran',
      division: 'quran',
      recordId: result.studentDbId,
      details: `Registered student ${full_name} directly to Quran class ${group.name}`
    });

    res.status(201).json({
      success: true,
      message: `Ardayga ${full_name} si toos ah ayaa loogu diiwaangeliyay fasalka ${group.name}.`,
      data: {
        id: result.studentDbId,
        student_id: result.studentIdCode,
        full_name,
        name_ar
      }
    });
  } catch (error) {
    next(error);
  }
}

// Add an already registered student to a class
export async function enrollExistingStudentToGroup(req, res, next) {
  try {
    const { id } = req.params; // group_id
    const { student_id } = req.body;
    const user = req.session.user;

    if (!student_id) {
      return res.status(400).json({ success: false, error: 'Fadlan dooro ardayga.' });
    }

    const [group] = await query(`SELECT id, name FROM quran_groups WHERE id = ?`, [id]);
    if (!group) {
      return res.status(404).json({ success: false, error: 'Fasalka lama helin.' });
    }

    const [student] = await query(`SELECT id, full_name, student_id FROM students WHERE id = ?`, [student_id]);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Ardayga lama helin.' });
    }

    const [activeEnrollment] = await query(`
      SELECT qe.group_id, qg.name as group_name
      FROM quran_enrollments qe
      JOIN quran_groups qg ON qg.id = qe.group_id
      WHERE qe.student_id = ? AND qe.status = 'active'
      LIMIT 1
    `, [student_id]);
    if (activeEnrollment && Number(activeEnrollment.group_id) !== Number(id)) {
      return res.status(400).json({
        success: false,
        error: `Ardaygan wuxuu hore ugu jiraa fasalka ${activeEnrollment.group_name}. Isticmaal tab-ka Beddel / Transfer Arday si taariikhda wareejinta loo kaydiyo.`
      });
    }

    await withTransaction(async (conn) => {
      const [existing] = await conn.execute(
        `SELECT id FROM quran_enrollments WHERE student_id = ? AND group_id = ?`,
        [student_id, id]
      );

      if (existing.length > 0) {
        await conn.execute(
          `UPDATE quran_enrollments SET status = 'active', enrollment_date = CURDATE() WHERE id = ?`,
          [existing[0].id]
        );
      } else {
        await conn.execute(
          `INSERT INTO quran_enrollments (student_id, group_id, enrollment_date, status)
           VALUES (?, ?, CURDATE(), 'active')`,
          [student_id, id]
        );
      }
    });

    await logAudit({
      userId: user.id,
      action: 'ENROLL_EXISTING_STUDENT_TO_QURAN_GROUP',
      module: 'quran',
      division: 'quran',
      recordId: student.id,
      details: `Enrolled student ${student.full_name} (${student.student_id}) to Quran class ${group.name}`
    });

    res.json({
      success: true,
      message: `Ardayga ${student.full_name} si guul leh ayaa loogu daray fasalka ${group.name}.`
    });
  } catch (error) {
    next(error);
  }
}

// Remove student from group
export async function removeStudentFromGroup(req, res, next) {
  try {
    const { id, studentId } = req.params;
    await query(
      `UPDATE quran_enrollments SET status = 'withdrawn' WHERE group_id = ? AND student_id = ?`,
      [id, studentId]
    );
    res.json({ success: true, message: 'Ardayga waa laga saaray fasalka.' });
  } catch (error) {
    next(error);
  }
}

// Get available registered students who can be added to a class
export async function getAvailableStudents(req, res, next) {
  try {
    const { search, exclude_group_id } = req.query;
    let sql = `
      SELECT s.id, s.student_id, s.full_name, s.name_ar, s.phone, s.gender,
             qe.group_id as current_group_id, qg.name as current_group_name
      FROM students s
      LEFT JOIN quran_enrollments qe ON s.id = qe.student_id AND qe.status = 'active'
      LEFT JOIN quran_groups qg ON qe.group_id = qg.id
      WHERE s.is_active = 1
    `;
    const params = [];

    if (exclude_group_id) {
      // Adding an existing student is intentionally limited to students who
      // have no active Quran class. Students already in another class must use
      // the audited transfer workflow below.
      sql += ` AND qe.group_id IS NULL`;
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      sql += ` AND (s.full_name LIKE ? OR s.name_ar LIKE ? OR s.student_id LIKE ? OR s.phone LIKE ?)`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY s.full_name ASC LIMIT 100`;

    const students = await query(sql, params);
    res.json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
}

// Search students who currently have an active Quran enrollment for transfer.
export async function getTransferStudents(req, res, next) {
  try {
    const search = String(req.query.search || '').trim();
    if (search.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const term = `%${search}%`;
    const students = await query(`
      SELECT s.id, s.student_id, s.full_name, s.name_ar, s.phone,
             qe.group_id as current_group_id,
             qg.name as current_group_name,
             qg.shift as current_group_shift,
             u.full_name as current_teacher_name
      FROM students s
      JOIN quran_enrollments qe ON qe.student_id = s.id AND qe.status = 'active'
      JOIN quran_groups qg ON qg.id = qe.group_id
      LEFT JOIN quran_teacher_assignments qta ON qta.group_id = qg.id
      LEFT JOIN users u ON u.id = qta.teacher_id
      WHERE s.is_active = 1
        AND (s.full_name LIKE ? OR s.name_ar LIKE ? OR s.student_id LIKE ? OR s.phone LIKE ?)
      ORDER BY s.full_name ASC, qe.id ASC
      LIMIT 50
    `, [term, term, term, term]);

    res.json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
}

// Searchable historical record of audited Quran class transfers.
export async function getQuranTransferHistory(req, res, next) {
  try {
    const { search, group_id, start_date, end_date } = req.query;
    let sql = `
      SELECT h.id, h.student_id, s.student_id as student_code, s.full_name as student_name,
             s.name_ar, h.from_group_id, fg.name as from_group_name, fg.shift as from_group_shift,
             h.to_group_id, tg.name as to_group_name, tg.shift as to_group_shift,
             h.transfer_date, h.reason, h.transferred_by, u.full_name as transferred_by_name,
             h.created_at
      FROM quran_student_transfer_history h
      JOIN students s ON s.id = h.student_id
      JOIN quran_groups fg ON fg.id = h.from_group_id
      JOIN quran_groups tg ON tg.id = h.to_group_id
      LEFT JOIN users u ON u.id = h.transferred_by
      WHERE 1 = 1
    `;
    const params = [];

    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      sql += ` AND (s.full_name LIKE ? OR s.name_ar LIKE ? OR s.student_id LIKE ? OR fg.name LIKE ? OR tg.name LIKE ?)`;
      params.push(term, term, term, term, term);
    }
    if (group_id && group_id !== 'all') {
      sql += ` AND (h.from_group_id = ? OR h.to_group_id = ?)`;
      params.push(group_id, group_id);
    }
    if (start_date) {
      sql += ` AND h.transfer_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND h.transfer_date <= ?`;
      params.push(end_date);
    }

    sql += ` ORDER BY h.transfer_date DESC, h.id DESC LIMIT 200`;
    const history = await query(sql, params);
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
}

// Move one active Quran enrollment atomically and preserve the event forever.
export async function transferQuranStudent(req, res, next) {
  try {
    const user = req.session.user;
    const studentId = Number.parseInt(req.body.student_id, 10);
    const destinationGroupId = Number.parseInt(req.body.to_group_id, 10);
    const transferDate = String(req.body.transfer_date || new Date().toISOString().slice(0, 10));
    const reason = req.body.reason ? String(req.body.reason).trim() : null;

    if (!Number.isInteger(studentId) || studentId <= 0 || !Number.isInteger(destinationGroupId) || destinationGroupId <= 0) {
      return res.status(400).json({ success: false, error: 'Ardayga iyo fasalka loo wareejinayo waa qasab.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transferDate)) {
      return res.status(400).json({ success: false, error: 'Taariikhda wareejintu ma saxna.' });
    }
    const parsedTransferDate = new Date(`${transferDate}T00:00:00Z`);
    if (Number.isNaN(parsedTransferDate.getTime()) || parsedTransferDate.toISOString().slice(0, 10) !== transferDate) {
      return res.status(400).json({ success: false, error: 'Taariikhda wareejintu ma saxna.' });
    }

    const result = await withTransaction(async (conn) => {
      const [[student]] = await conn.execute(
        `SELECT id, student_id, full_name FROM students WHERE id = ? AND is_active = 1 FOR UPDATE`,
        [studentId]
      );
      if (!student) {
        const error = new Error('Ardayga lama helin ama ma aha arday firfircoon.');
        error.status = 404;
        throw error;
      }

      const groups = await conn.execute(
        `SELECT id, name, shift, is_active FROM quran_groups WHERE id IN (?, ?) FOR UPDATE`,
        [destinationGroupId, destinationGroupId]
      ).then(([rows]) => rows);
      const destination = groups.find(group => Number(group.id) === destinationGroupId);
      if (!destination || !destination.is_active) {
        const error = new Error('Fasalka loo wareejinayo lama helin ama ma aha fasal firfircoon.');
        error.status = 400;
        throw error;
      }

      const activeEnrollments = await conn.execute(`
        SELECT qe.id, qe.group_id, qg.name as group_name
        FROM quran_enrollments qe
        JOIN quran_groups qg ON qg.id = qe.group_id
        WHERE qe.student_id = ? AND qe.status = 'active'
        FOR UPDATE
      `, [studentId]).then(([rows]) => rows);

      if (activeEnrollments.length === 0) {
        const error = new Error('Ardaygan hadda kuma jiro fasal firfircoon.');
        error.status = 400;
        throw error;
      }
      if (activeEnrollments.length > 1) {
        const error = new Error('Xogta ardaygan waxay leedahay fasallo firfircoon oo badan; marka hore sax xogta.');
        error.status = 409;
        throw error;
      }

      const current = activeEnrollments[0];
      if (Number(current.group_id) === destinationGroupId) {
        const error = new Error('Ardaygan hore ayuu ugu jiraa fasalkaas; lama wareejin karo isla fasalka.');
        error.status = 400;
        throw error;
      }

      const [destinationRows] = await conn.execute(
        `SELECT id, status FROM quran_enrollments WHERE student_id = ? AND group_id = ? FOR UPDATE`,
        [studentId, destinationGroupId]
      );

      await conn.execute(
        `UPDATE quran_enrollments SET status = 'completed' WHERE id = ? AND status = 'active'`,
        [current.id]
      );

      if (destinationRows.length > 0) {
        await conn.execute(
          `UPDATE quran_enrollments SET status = 'active', enrollment_date = ? WHERE id = ?`,
          [transferDate, destinationRows[0].id]
        );
      } else {
        await conn.execute(
          `INSERT INTO quran_enrollments (student_id, group_id, enrollment_date, status) VALUES (?, ?, ?, 'active')`,
          [studentId, destinationGroupId, transferDate]
        );
      }

      const [historyResult] = await conn.execute(`
        INSERT INTO quran_student_transfer_history
          (student_id, from_group_id, to_group_id, transfer_date, reason, transferred_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [studentId, current.group_id, destinationGroupId, transferDate, reason, user.id]);

      return {
        historyId: historyResult.insertId,
        student,
        fromGroupId: current.group_id,
        fromGroupName: current.group_name,
        toGroupId: destination.id,
        toGroupName: destination.name,
        transferDate
      };
    });

    await logAudit({
      userId: user.id,
      action: 'TRANSFER_QURAN_STUDENT',
      module: 'quran_enrollments',
      division: 'quran',
      recordId: result.student.id,
      details: {
        student_id: result.student.id,
        from_group_id: result.fromGroupId,
        to_group_id: result.toGroupId,
        transfer_date: result.transferDate,
        reason
      }
    });

    res.json({
      success: true,
      message: `Ardayga ${result.student.full_name} si guul leh ayaa looga wareejiyay ${result.fromGroupName} waxaana loo wareejiyay ${result.toGroupName}.`,
      data: {
        history_id: result.historyId,
        student_id: result.student.id,
        from_group_id: result.fromGroupId,
        to_group_id: result.toGroupId,
        transfer_date: result.transferDate
      }
    });
  } catch (error) {
    next(error);
  }
}

// Get all 114 Surahs for a student
export async function getStudentSurahs(req, res, next) {
  try {
    const { id } = req.params; // student_id
    const user = req.session.user;

    // Strict Teacher Scoping
    if (user.role === 'teacher') {
      const [enrollment] = await query(
        `SELECT group_id FROM quran_enrollments WHERE student_id = ? AND status = 'active'`,
        [id]
      );
      if (enrollment) {
        const isAssigned = await quranService.isTeacherAssignedToGroup(user.id, enrollment.group_id);
        if (!isAssigned) {
          return res.status(403).json({ success: false, error: 'Ma lihid ogolaansho aad ku aragto ardaygan.' });
        }
      }
    }

    const data = await quranService.getStudentSurahs(id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// Bulk save completed Surahs for a student
export async function saveStudentSurahs(req, res, next) {
  try {
    const { id } = req.params; // student_id
    const { surah_numbers } = req.body;
    const user = req.session.user;

    if (!Array.isArray(surah_numbers)) {
      return res.status(400).json({ success: false, error: 'surah_numbers waa inuu noqdaa array.' });
    }

    // Strict Teacher Scoping
    if (user.role === 'teacher') {
      const [enrollment] = await query(
        `SELECT group_id FROM quran_enrollments WHERE student_id = ? AND status = 'active'`,
        [id]
      );
      if (enrollment) {
        const isAssigned = await quranService.isTeacherAssignedToGroup(user.id, enrollment.group_id);
        if (!isAssigned) {
          return res.status(403).json({ success: false, error: 'Ma lihid ogolaansho aad ku xifdiso ardaygan.' });
        }
      }
    }

    const result = await quranService.saveStudentSurahs(id, surah_numbers, user);

    await logAudit({
      userId: user.id,
      action: 'SAVE_STUDENT_QURAN_SURAHS',
      module: 'quran',
      division: 'quran',
      recordId: id,
      details: `Saved ${result.completed_surahs_count} completed surahs for student #${id}`
    });

    res.json({
      success: true,
      message: 'Xifdiga suuradaha si guul leh ayaa loo kaydiyay!',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

// Teacher Assignments
export async function getQuranTeacherAssignments(req, res, next) {
  try {
    const assignments = await query(`
      SELECT qta.*, u.full_name as teacher_name, qg.name as group_name, qg.shift
      FROM quran_teacher_assignments qta
      JOIN users u ON qta.teacher_id = u.id
      JOIN quran_groups qg ON qta.group_id = qg.id
      ORDER BY u.full_name ASC
    `);
    res.json({ success: true, data: assignments });
  } catch (error) {
    next(error);
  }
}

export async function createQuranTeacherAssignment(req, res, next) {
  try {
    const { teacher_id, group_id } = req.body;
    if (!teacher_id || !group_id) {
      return res.status(400).json({ success: false, error: 'Macallinka iyo halaqada waa qasab.' });
    }

    await query(
      `INSERT INTO quran_teacher_assignments (teacher_id, group_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP`,
      [teacher_id, group_id]
    );

    res.status(201).json({ success: true, message: 'Macallinka si guul leh ayaa loogu qoray fasalka/halaqada.' });
  } catch (error) {
    next(error);
  }
}

export async function removeQuranTeacherAssignment(req, res, next) {
  try {
    const { id } = req.params;
    await query(`DELETE FROM quran_teacher_assignments WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Qorista macallinka waa laga saaray.' });
  } catch (error) {
    next(error);
  }
}

// Quran Surahs Catalog (All 114)
export async function getSurahs(req, res, next) {
  try {
    const surahs = await quranService.getAllSurahs();
    res.json({ success: true, data: surahs });
  } catch (error) {
    next(error);
  }
}

// Quran Juz Catalog (All 30)
export async function getJuzList(req, res, next) {
  try {
    const juz = await quranService.getAllJuz();
    res.json({ success: true, data: juz });
  } catch (error) {
    next(error);
  }
}

// Surah Verses with student's memorization state
export async function getSurahVerses(req, res, next) {
  try {
    const { number } = req.params;
    const { student_id } = req.query;

    if (!student_id) {
      return res.status(400).json({ success: false, error: 'Dooro ardayga si loo eego aayadaha.' });
    }

    const user = req.session.user;
    if (user.role === 'teacher') {
      // Verify teacher has access to this student's active group
      const [enrollment] = await query(
        `SELECT group_id FROM quran_enrollments WHERE student_id = ? AND status = 'active'`,
        [student_id]
      );
      if (enrollment) {
        const isAssigned = await quranService.isTeacherAssignedToGroup(user.id, enrollment.group_id);
        if (!isAssigned) {
          return res.status(403).json({ success: false, error: 'Ma lihid ogolaansho aad ku aragto ardaygan.' });
        }
      }
    }

    const data = await quranService.getSurahVersesForStudent(student_id, number);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// Save student's verse-level memorization
export async function saveSurahVerses(req, res, next) {
  try {
    const { number } = req.params;
    const { student_id, memorized_verses } = req.body;
    const user = req.session.user;

    if (!student_id) {
      return res.status(400).json({ success: false, error: 'student_id waa qasab.' });
    }

    if (user.role === 'teacher') {
      const [enrollment] = await query(
        `SELECT group_id FROM quran_enrollments WHERE student_id = ? AND status = 'active'`,
        [student_id]
      );
      if (enrollment) {
        const isAssigned = await quranService.isTeacherAssignedToGroup(user.id, enrollment.group_id);
        if (!isAssigned) {
          return res.status(403).json({ success: false, error: 'Ma lihid ogolaansho aad ku xifdiso ardaygan.' });
        }
      }
    }

    const result = await quranService.saveStudentVerseMemorization(
      student_id,
      number,
      memorized_verses,
      user.id
    );

    // Also get updated student summary for real-time progress update
    const summary = await quranService.calculateStudentMemorizationSummary(student_id);

    res.json({
      success: true,
      message: 'Aayadaha la xifdiyay si guul leh ayaa loo kaydiyay.',
      data: {
        surah_progress: result,
        student_summary: summary
      }
    });
  } catch (error) {
    next(error);
  }
}

// Comprehensive Student Memorization Summary
export async function getStudentMemorizationSummary(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.session.user;

    if (user.role === 'teacher') {
      const [enrollment] = await query(
        `SELECT group_id FROM quran_enrollments WHERE student_id = ? AND status = 'active'`,
        [id]
      );
      if (enrollment) {
        const isAssigned = await quranService.isTeacherAssignedToGroup(user.id, enrollment.group_id);
        if (!isAssigned) {
          return res.status(403).json({ success: false, error: 'Ma lihid ogolaansho aad ku aragto ardaygan.' });
        }
      }
    }

    const summary = await quranService.calculateStudentMemorizationSummary(id, user);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
}

// Quran Examinations
export async function getStudentExaminations(req, res, next) {
  try {
    const { student_id } = req.query;
    let sql = `
      SELECT qe.*, s.student_id as student_code, s.full_name as student_name, s.name_ar as student_name_ar,
             qg.name as group_name, u.full_name as created_by_name
      FROM quran_student_examinations qe
      JOIN students s ON qe.student_id = s.id
      LEFT JOIN quran_groups qg ON qe.group_id = qg.id
      LEFT JOIN users u ON qe.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (student_id) {
      sql += ` AND qe.student_id = ?`;
      params.push(student_id);
    }
    sql += ` ORDER BY qe.exam_date DESC, qe.id DESC`;

    const exams = await query(sql, params);
    res.json({ success: true, data: exams });
  } catch (error) {
    next(error);
  }
}

export async function createStudentExamination(req, res, next) {
  try {
    const user = req.session.user;
    const result = await quranService.recordStudentExamination(req.body, user);
    res.status(201).json({
      success: true,
      message: 'Imtixaanka Quraanka ee ardayga si guul leh ayaa loo diiwaangeliyay.',
      id: result.id
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStudentExamination(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.session.user;
    await quranService.updateStudentExamination(id, req.body, user);
    res.json({ success: true, message: 'Imtixaanka ardayga waa la saxay.' });
  } catch (error) {
    next(error);
  }
}

// Existing Legacy Hifdh Progress log methods (retained for backward compatibility)
export async function getHifdhProgress(req, res, next) {
  try {
    const { student_id, group_id, start_date, end_date } = req.query;
    let sql = `
      SELECT qp.*, s.student_id as student_code, s.full_name as student_name, s.name_ar as student_name_ar,
             qg.name as group_name, u.full_name as recorded_by_name
      FROM quran_progress qp
      JOIN students s ON qp.student_id = s.id
      JOIN quran_groups qg ON qp.group_id = qg.id
      JOIN users u ON qp.recorded_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (student_id) {
      sql += ` AND qp.student_id = ?`;
      params.push(student_id);
    }
    if (group_id) {
      sql += ` AND qp.group_id = ?`;
      params.push(group_id);
    }
    if (start_date) {
      sql += ` AND qp.record_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND qp.record_date <= ?`;
      params.push(end_date);
    }

    sql += ` ORDER BY qp.record_date DESC, qp.id DESC LIMIT 200`;

    const records = await query(sql, params);
    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
}

export async function recordHifdhProgress(req, res, next) {
  try {
    const user = req.session.user;
    const { student_id, group_id, record_date, current_juz, surah_name, from_ayah, to_ayah, revision_summary, rating, notes } = req.body;

    if (!student_id || !group_id || !surah_name) {
      return res.status(400).json({
        success: false,
        error: 'Ardayga, halaqada, iyo magaca suuradda waa qasab.'
      });
    }

    const result = await query(
      `INSERT INTO quran_progress (student_id, group_id, record_date, current_juz, surah_name, from_ayah, to_ayah, revision_summary, rating, recorded_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        student_id,
        group_id,
        record_date || new Date().toISOString().split('T')[0],
        current_juz || null,
        surah_name.trim(),
        from_ayah || null,
        to_ayah || null,
        revision_summary || null,
        rating || 'mumtaz',
        user.id,
        notes || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Horumarka xifdiga ardayga si guul leh ayaa loo diiwaangeliyay.',
      id: result.insertId
    });
  } catch (error) {
    next(error);
  }
}

// Quran Certificates
export async function getCertificates(req, res, next) {
  try {
    const { student_id } = req.query;
    const certificates = await quranService.getQuranCertificates({ student_id });
    res.json({ success: true, data: certificates });
  } catch (error) {
    next(error);
  }
}

export async function issueCertificate(req, res, next) {
  try {
    const user = req.session.user;
    const result = await quranService.issueQuranCertificate(req.body, user);
    res.status(201).json({
      success: true,
      message: 'Shahaadada Quraanka si guul leh ayaa loo bixiyay.',
      data: result
    });
  } catch (error) {
    next(error);
  }
}
