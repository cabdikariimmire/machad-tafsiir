import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db/connection.js';
import { logAudit } from '../services/auditService.js';

/**
 * List all registered Quran School teachers with their assigned classes
 */
export async function listQuranTeachers(req, res, next) {
  try {
    // 1. Fetch all teachers in Quran division or cross-division
    const teachers = await query(`
      SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active, u.created_at,
             r.name as role_name, r.display_name as role_display
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE (r.name = 'teacher' OR u.role_id = 7)
        AND (u.division_scope = 'quran' OR u.division_scope = 'all')
      ORDER BY u.full_name ASC
    `);

    // 2. Fetch all Quran class/group assignments
    const assignments = await query(`
      SELECT qta.id as assignment_id, qta.teacher_id, qg.id as group_id, qg.name as group_name, qg.shift,
             ql.name as level_name
      FROM quran_teacher_assignments qta
      JOIN quran_groups qg ON qta.group_id = qg.id
      LEFT JOIN quran_levels ql ON qg.level_id = ql.id
      ORDER BY qg.name ASC
    `);

    // 3. Map assignments to each teacher
    const map = new Map();
    for (const a of assignments) {
      if (!map.has(a.teacher_id)) {
        map.set(a.teacher_id, []);
      }
      map.get(a.teacher_id).push({
        assignment_id: a.assignment_id,
        id: a.group_id,
        name: a.group_name,
        shift: a.shift,
        level_name: a.level_name
      });
    }

    const result = teachers.map(t => ({
      ...t,
      classes: map.get(t.id) || []
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Register a new Quran School teacher and assign classes
 */
export async function createQuranTeacher(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { full_name, username, password, phone, email, group_ids, is_active } = req.body;

    // Server-side validation
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ success: false, error: 'Magaca buuxa ee macallinka waa qasab.' });
    }
    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, error: 'Magaca isticmaalaha (username) waa qasab.' });
    }
    if (!password || password.trim().length < 6) {
      return res.status(400).json({ success: false, error: 'Furaha sirta ah waa inuu ugu yaraan ka koobnaadaa 6 xaraf.' });
    }

    // Check unique username
    const existing = await query('SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Magaca isticmaalaha (username) horey ayaa loo qaatay. Fadlan dooro mid kale.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password.trim(), salt);
    const activeStatus = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    let newTeacherId = null;

    await withTransaction(async (conn) => {
      // 1. Create teacher user account (role_id: 7 = teacher, division_scope: 'quran')
      const [insertResult] = await conn.execute(
        `INSERT INTO users (username, password_hash, full_name, email, phone, role_id, division_scope, is_active, created_by)
         VALUES (?, ?, ?, ?, ?, 7, 'quran', ?, ?)`,
        [
          username.trim(),
          passwordHash,
          full_name.trim(),
          email ? email.trim() : null,
          phone ? phone.trim() : null,
          activeStatus,
          currentUser.id
        ]
      );
      newTeacherId = insertResult.insertId;

      // 2. Assign classes/groups if provided
      if (Array.isArray(group_ids) && group_ids.length > 0) {
        const uniqueGroupIds = [...new Set(group_ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0))];
        for (const gid of uniqueGroupIds) {
          await conn.execute(
            `INSERT INTO quran_teacher_assignments (teacher_id, group_id) VALUES (?, ?)`,
            [newTeacherId, gid]
          );
        }
      }
    });

    await logAudit({
      userId: currentUser.id,
      action: 'CREATE_QURAN_TEACHER',
      module: 'quran_teachers',
      division: 'quran',
      recordId: newTeacherId,
      details: `Created Quran teacher ${full_name.trim()} (${username.trim()}) with ${Array.isArray(group_ids) ? group_ids.length : 0} assigned classes`,
      afterValue: { username: username.trim(), full_name: full_name.trim(), group_ids, is_active: activeStatus },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Macallinka cusub si guul leh ayaa loo diiwaangeliyay.',
      teacherId: newTeacherId
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Edit an existing teacher's profile and class assignments
 */
export async function updateQuranTeacher(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { id } = req.params;
    const { full_name, phone, email, is_active, group_ids, new_password } = req.body;

    const [teacher] = await query(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ? AND (r.name = 'teacher' OR u.role_id = 7)`,
      [id]
    );

    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Macallinka lama helin.' });
    }

    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ success: false, error: 'Magaca macallinka waa qasab.' });
    }

    let passwordHash = teacher.password_hash;
    if (new_password && new_password.trim().length >= 6) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(new_password.trim(), salt);
    }

    const activeStatus = is_active !== undefined ? (is_active ? 1 : 0) : teacher.is_active;

    await withTransaction(async (conn) => {
      // 1. Update basic details
      await conn.execute(
        `UPDATE users 
         SET full_name = ?, phone = ?, email = ?, is_active = ?, password_hash = ?
         WHERE id = ?`,
        [
          full_name.trim(),
          phone ? phone.trim() : null,
          email ? email.trim() : null,
          activeStatus,
          passwordHash,
          id
        ]
      );

      // 2. Synchronize class assignments if group_ids provided
      if (Array.isArray(group_ids)) {
        // Remove current assignments
        await conn.execute(`DELETE FROM quran_teacher_assignments WHERE teacher_id = ?`, [id]);

        // Add new assignments
        const uniqueGroupIds = [...new Set(group_ids.map(gid => parseInt(gid, 10)).filter(gid => !isNaN(gid) && gid > 0))];
        for (const gid of uniqueGroupIds) {
          await conn.execute(
            `INSERT INTO quran_teacher_assignments (teacher_id, group_id) VALUES (?, ?)`,
            [id, gid]
          );
        }
      }
    });

    await logAudit({
      userId: currentUser.id,
      action: 'UPDATE_QURAN_TEACHER',
      module: 'quran_teachers',
      division: 'quran',
      recordId: id,
      details: `Updated Quran teacher ${full_name.trim()} (${teacher.username})`,
      beforeValue: { full_name: teacher.full_name, is_active: teacher.is_active },
      afterValue: { full_name: full_name.trim(), is_active: activeStatus, group_ids },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Xogta macallinka si guul leh ayaa loo cusbooneysiiyay.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Toggle teacher active/inactive status
 */
export async function toggleQuranTeacherStatus(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { id } = req.params;

    const [teacher] = await query(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ? AND (r.name = 'teacher' OR u.role_id = 7)`,
      [id]
    );

    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Macallinka lama helin.' });
    }

    const newStatus = teacher.is_active ? 0 : 1;
    await query(`UPDATE users SET is_active = ? WHERE id = ?`, [newStatus, id]);

    await logAudit({
      userId: currentUser.id,
      action: newStatus ? 'ACTIVATE_TEACHER' : 'DEACTIVATE_TEACHER',
      module: 'quran_teachers',
      division: 'quran',
      recordId: id,
      details: `${newStatus ? 'Activated' : 'Deactivated'} teacher ${teacher.full_name} (${teacher.username})`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      is_active: newStatus,
      message: `Macallinka waxaa laga dhigay: ${newStatus ? 'Shaqaynaya (Active)' : 'Xanniban (Inactive)'}`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Permanently delete a teacher and cleanly resolve references
 */
export async function deleteQuranTeacher(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { id } = req.params;

    const [teacher] = await query(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`,
      [id]
    );

    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Macallinka lama helin.' });
    }

    if (parseInt(id, 10) === currentUser.id) {
      return res.status(400).json({ success: false, error: 'Ma tirtiri kartid akoonkaaga aad hadda ku jirto.' });
    }

    await withTransaction(async (conn) => {
      // 1. Delete class/timetable assignments & notifications
      await conn.execute(`DELETE FROM quran_teacher_assignments WHERE teacher_id = ?`, [id]);
      await conn.execute(`DELETE FROM institute_teacher_assignments WHERE teacher_id = ?`, [id]);
      await conn.execute(`DELETE FROM institute_timetable WHERE teacher_id = ?`, [id]);
      await conn.execute(`DELETE FROM user_module_scopes WHERE user_id = ?`, [id]);
      await conn.execute(`DELETE FROM notifications WHERE user_id = ?`, [id]);

      // 2. Safely reassign creator / entered_by to currentUser so database integrity is kept
      await conn.execute(`UPDATE quran_verse_memorization SET recorded_by = ? WHERE recorded_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE quran_attendance SET updated_by = ? WHERE updated_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE quran_sessions SET recorded_by = ? WHERE recorded_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE quran_progress SET recorded_by = ? WHERE recorded_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE quran_exams SET created_by = ? WHERE created_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE quran_exam_marks SET entered_by = ? WHERE entered_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE quran_student_examinations SET examiner_id = NULL WHERE examiner_id = ?`, [id]);
      await conn.execute(`UPDATE quran_student_examinations SET created_by = ? WHERE created_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE audit_logs SET user_id = ? WHERE user_id = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE institute_class_sessions SET recorded_by = ? WHERE recorded_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE institute_exams SET created_by = ? WHERE created_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE institute_exam_marks SET entered_by = ? WHERE entered_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE institute_attendance SET updated_by = ? WHERE updated_by = ?`, [currentUser.id, id]);

      // 3. Permanently delete teacher from users table
      await conn.execute(`DELETE FROM users WHERE id = ?`, [id]);
    });

    await logAudit({
      userId: currentUser.id,
      action: 'DELETE_TEACHER',
      module: 'quran_teachers',
      division: 'quran',
      recordId: id,
      details: `Permanently deleted teacher ${teacher.full_name}`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      deleted: true,
      message: `Macallinka ${teacher.full_name} si joogto ah ayaa loo tirtiray.`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Archive or restore a teacher (toggle is_active: 0 = archived, 1 = active)
 */
export async function archiveQuranTeacher(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { id } = req.params;

    const [teacher] = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Macallinka lama helin.' });
    }

    const newStatus = teacher.is_active ? 0 : 1;
    await withTransaction(async (conn) => {
      await conn.execute('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, id]);
      if (newStatus === 0) {
        await conn.execute('DELETE FROM quran_teacher_assignments WHERE teacher_id = ?', [id]);
      }
    });

    await logAudit({
      userId: currentUser.id,
      action: newStatus === 0 ? 'ARCHIVE_TEACHER' : 'RESTORE_TEACHER',
      module: 'quran_teachers',
      recordId: id,
      details: `${newStatus === 0 ? 'Archived' : 'Restored'} teacher ${teacher.full_name}`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      is_active: newStatus,
      message: newStatus === 0
        ? `Macallinka ${teacher.full_name} waa la xareeyay (Archived). Liiska firfircoon kuma soo baxayo, laakiin warbixinada (Reports) xogtiisu way ku jirtaa.`
        : `Macallinka ${teacher.full_name} dib ayaa loo soo celiyay (Restored / Active).`
    });
  } catch (error) {
    next(error);
  }
}

