import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db/connection.js';
import { logAudit } from '../services/auditService.js';

export async function listUsers(req, res, next) {
  try {
    const currentUser = req.session.user;
    let sql = `
      SELECT u.id, u.username, u.full_name, u.email, u.phone, 
             u.division_scope, u.is_active, u.created_at,
             r.id as role_id, r.name as role_name, r.display_name as role_display
      FROM users u
      JOIN roles r ON u.role_id = r.id
    `;
    const params = [];

    // Division scope filtering
    if (currentUser.role === 'institute_admin') {
      sql += ` WHERE u.division_scope = 'institute'`;
    } else if (currentUser.role === 'quran_admin') {
      sql += ` WHERE u.division_scope = 'quran'`;
    }

    sql += ` ORDER BY u.created_at DESC`;

    const users = await query(sql, params);
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
}

export async function listRoles(req, res, next) {
  try {
    const currentUser = req.session.user;
    let sql = `SELECT id, name, display_name, description FROM roles`;
    
    // Non-super-admins cannot see super_admin role
    if (currentUser.role !== 'super_admin') {
      sql += ` WHERE name != 'super_admin'`;
    }

    const roles = await query(sql);
    res.json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
}

export async function createUser(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { username, password, full_name, email, phone, role_id, division_scope } = req.body;

    if (!username || !password || !full_name || !role_id) {
      return res.status(400).json({
        success: false,
        error: 'Magaca isticmaalaha, furaha, magaca buuxa, iyo doorka (role) waa qasab.'
      });
    }

    // Verify role being assigned
    const [role] = await query('SELECT id, name FROM roles WHERE id = ?', [role_id]);
    if (!role) {
      return res.status(400).json({ success: false, error: 'Doorka la doortay ma jiro.' });
    }

    // Role and Scope constraints
    if (role.name === 'super_admin' && currentUser.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Kaliya Maamulaha Guud (Super Admin) ayaa abuuri kara Super Admin kale.'
      });
    }

    let assignedScope = division_scope || 'institute';
    if (currentUser.role === 'institute_admin') {
      assignedScope = 'institute'; // Institute Admin can ONLY create users for Institute
    } else if (currentUser.role === 'quran_admin') {
      assignedScope = 'quran'; // Quran Admin can ONLY create users for Quran
    } else if (assignedScope === 'all' && currentUser.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Kaliya Super Admin ayaa bixin kara ogolaanshaha labada waaxood (all).'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await query(
      `INSERT INTO users (username, password_hash, full_name, email, phone, role_id, division_scope, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [username.trim(), passwordHash, full_name.trim(), email || null, phone || null, role_id, assignedScope, currentUser.id]
    );

    await logAudit({
      userId: currentUser.id,
      action: 'CREATE_USER',
      module: 'users',
      division: assignedScope === 'all' ? 'system' : assignedScope,
      recordId: result.insertId,
      details: `Created user ${username} with role ${role.name} and scope ${assignedScope}`,
      afterValue: { username, full_name, role_id, division_scope: assignedScope },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Isticmaalaha cusub si guul leh ayaa loo abuuray.',
      userId: result.insertId
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { id } = req.params;
    const { username, full_name, email, phone, role_id, division_scope, is_active, new_password } = req.body;

    const [targetUser] = await query(
      `SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [id]
    );

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Isticmaalaha lama helin.' });
    }

    // Permission boundaries
    if (targetUser.role_name === 'super_admin' && currentUser.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Uma lihid fasax inaad wax ka beddesho xisaabta Super Admin.'
      });
    }

    if (currentUser.role === 'institute_admin' && targetUser.division_scope !== 'institute') {
      return res.status(403).json({
        success: false,
        error: 'Waxaad wax ka beddeli kartaa oo keliya isticmaalayaasha waaxda Machadka.'
      });
    }

    if (currentUser.role === 'quran_admin' && targetUser.division_scope !== 'quran') {
      return res.status(403).json({
        success: false,
        error: 'Waxaad wax ka beddeli kartaa oo keliya isticmaalayaasha waaxda Quraanka.'
      });
    }

    let updatedScope = targetUser.division_scope;
    if (currentUser.role === 'super_admin' && division_scope) {
      updatedScope = division_scope;
    }

    let updatedRoleId = role_id ? parseInt(role_id, 10) : targetUser.role_id;
    let passwordHash = targetUser.password_hash;
    if (new_password && new_password.trim()) {
      if (new_password.trim().length < 4) {
        return res.status(400).json({ success: false, error: 'Furaha cusub waa inuu ugu yaraan ka koobnaadaa 4 xaraf.' });
      }
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(new_password.trim(), salt);
    }

    let updatedUsername = targetUser.username;
    if (username && username.trim().toLowerCase() !== targetUser.username.toLowerCase()) {
      const [existing] = await query('SELECT id FROM users WHERE username = ? AND id != ?', [username.trim(), id]);
      if (existing) {
        return res.status(400).json({ success: false, error: 'Magaca isticmaalaha (username) horey ayaa loo isticmaalay.' });
      }
      updatedUsername = username.trim();
    }

    const updatedActive = typeof is_active === 'boolean' ? is_active : targetUser.is_active;

    await query(
      `UPDATE users 
       SET username = ?, full_name = ?, email = ?, phone = ?, role_id = ?, division_scope = ?, is_active = ?, password_hash = ?
       WHERE id = ?`,
      [
        updatedUsername,
        full_name ? full_name.trim() : targetUser.full_name,
        email !== undefined ? email : targetUser.email,
        phone !== undefined ? phone : targetUser.phone,
        updatedRoleId,
        updatedScope,
        updatedActive,
        passwordHash,
        id
      ]
    );

    await logAudit({
      userId: currentUser.id,
      action: 'UPDATE_USER',
      module: 'users',
      division: updatedScope === 'all' ? 'system' : updatedScope,
      recordId: id,
      details: `Updated user ${updatedUsername}`,
      beforeValue: { username: targetUser.username, full_name: targetUser.full_name, is_active: targetUser.is_active, division_scope: targetUser.division_scope },
      afterValue: { username: updatedUsername, full_name, is_active: updatedActive, division_scope: updatedScope },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Xogta isticmaalaha si guul leh ayaa loo cusbooneysiiyay.'
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.trim().length < 4) {
      return res.status(400).json({
        success: false,
        error: 'Fadlan geli fure cusub oo ugu yaraan ka kooban 4 xaraf.'
      });
    }

    const [targetUser] = await query(
      `SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [id]
    );

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Isticmaalaha lama helin.' });
    }

    if (targetUser.role_name === 'super_admin' && currentUser.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Uma lihid fasax inaad beddesho furaha Super Admin.'
      });
    }

    if (currentUser.role === 'institute_admin' && targetUser.division_scope !== 'institute') {
      return res.status(403).json({
        success: false,
        error: 'Waxaad beddeli kartaa oo keliya furaha isticmaalayaasha waaxda Machadka.'
      });
    }

    if (currentUser.role === 'quran_admin' && targetUser.division_scope !== 'quran') {
      return res.status(403).json({
        success: false,
        error: 'Waxaad beddeli kartaa oo keliya furaha isticmaalayaasha waaxda Quraanka.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(new_password.trim(), salt);

    await query(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, id]);

    await logAudit({
      userId: currentUser.id,
      action: 'RESET_USER_PASSWORD',
      module: 'users',
      division: targetUser.division_scope === 'all' ? 'system' : targetUser.division_scope,
      recordId: id,
      details: `Admin reset password for user '${targetUser.username}'`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Furaha isticmaalaha '${targetUser.username}' si guul leh ayaa loo beddelay.`
    });
  } catch (error) {
    next(error);
  }
}

export async function toggleUserStatus(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { id } = req.params;

    const [targetUser] = await query(`SELECT * FROM users WHERE id = ?`, [id]);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Isticmaalaha lama helin.' });
    }

    if (parseInt(id, 10) === currentUser.id) {
      return res.status(400).json({
        success: false,
        error: 'Iskama xannibi kartid akoonkaaga adigu shakhsi ahaan.'
      });
    }

    const newStatus = !targetUser.is_active;
    await query(`UPDATE users SET is_active = ? WHERE id = ?`, [newStatus, id]);

    await logAudit({
      userId: currentUser.id,
      action: newStatus ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      module: 'users',
      recordId: id,
      details: `${newStatus ? 'Activated' : 'Deactivated'} user ${targetUser.username}`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Isticmaalaha waxaa laga dhigay: ${newStatus ? 'Shaqaynaya (Active)' : 'Xanniban (Inactive)'}`,
      is_active: newStatus
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const currentUser = req.session.user;
    const { id } = req.params;

    const [targetUser] = await query(`SELECT * FROM users WHERE id = ?`, [id]);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Isticmaalaha lama helin.' });
    }

    if (parseInt(id, 10) === currentUser.id) {
      return res.status(400).json({
        success: false,
        error: 'Ma tirtiri kartid akoonkaaga aad hadda ku jirto.'
      });
    }

    // Role safety: Non-super-admins cannot delete a super_admin
    if (targetUser.role_id === 1 && currentUser.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Kaliya Super Admin ayaa tirtiri kara maamule sare.'
      });
    }

    await withTransaction(async (conn) => {
      // 1. Delete user module scopes & notifications
      await conn.execute(`DELETE FROM user_module_scopes WHERE user_id = ?`, [id]);
      await conn.execute(`DELETE FROM notifications WHERE user_id = ?`, [id]);

      // 2. Unassign teacher assignments
      await conn.execute(`DELETE FROM quran_teacher_assignments WHERE teacher_id = ?`, [id]);
      await conn.execute(`DELETE FROM institute_teacher_assignments WHERE teacher_id = ?`, [id]);
      await conn.execute(`DELETE FROM institute_timetable WHERE teacher_id = ?`, [id]);

      // 3. Reassign references to currentUser to keep historical integrity without FK errors
      await conn.execute(`UPDATE students SET created_by = ? WHERE created_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE users SET created_by = ? WHERE created_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE quran_exams SET created_by = ? WHERE created_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE institute_exams SET created_by = ? WHERE created_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE institute_exam_sets SET created_by = ? WHERE created_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE exam_timetables SET created_by = ? WHERE created_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE fee_rules SET created_by = ? WHERE created_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE audit_logs SET user_id = ? WHERE user_id = ?`, [currentUser.id, id]);

      await conn.execute(`UPDATE quran_student_examinations SET examiner_id = NULL WHERE examiner_id = ?`, [id]);
      await conn.execute(`UPDATE quran_student_examinations SET created_by = ? WHERE created_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE quran_exam_marks SET entered_by = ? WHERE entered_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE institute_exam_marks SET entered_by = ? WHERE entered_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE quran_verse_memorization SET recorded_by = ? WHERE recorded_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE quran_attendance SET updated_by = ? WHERE updated_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE institute_attendance SET updated_by = ? WHERE updated_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE quran_sessions SET recorded_by = ? WHERE recorded_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE quran_progress SET recorded_by = ? WHERE recorded_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE institute_class_sessions SET recorded_by = ? WHERE recorded_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE payments SET received_by = ? WHERE received_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE payment_adjustments SET adjusted_by = ? WHERE adjusted_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE student_discounts SET approved_by = ? WHERE approved_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE student_promotion_history SET processed_by = ? WHERE processed_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE promotion_result_confirmations SET confirmed_by = ? WHERE confirmed_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE quran_student_transfer_history SET transferred_by = ? WHERE transferred_by = ?`, [currentUser.id, id]);
      await conn.execute(`UPDATE quran_certificates SET issued_by = ? WHERE issued_by = ?`, [currentUser.id, id]);

      // 4. Finally delete user
      await conn.execute(`DELETE FROM users WHERE id = ?`, [id]);
    });

    await logAudit({
      userId: currentUser.id,
      action: 'DELETE_USER',
      module: 'users',
      recordId: id,
      details: `Permanently deleted user '${targetUser.username}' (${targetUser.full_name})`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Isticmaalaha '${targetUser.username}' si joogto ah ayaa loo tirtiray.`
    });
  } catch (error) {
    next(error);
  }
}

