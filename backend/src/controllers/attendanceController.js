import { query, withTransaction } from '../db/connection.js';
import { logAudit } from '../services/auditService.js';

async function teacherHasInstituteAssignment(teacherId, classId, subjectId = null) {
  let sql = `SELECT id FROM institute_teacher_assignments WHERE teacher_id = ? AND class_id = ?`;
  const params = [teacherId, classId];
  if (subjectId) {
    sql += ` AND subject_id = ?`;
    params.push(subjectId);
  }
  const [assignment] = await query(sql, params);
  return !!assignment;
}

async function teacherHasQuranAssignment(teacherId, groupId) {
  const [assignment] = await query(
    `SELECT id FROM quran_teacher_assignments WHERE teacher_id = ? AND group_id = ?`,
    [teacherId, groupId]
  );
  return !!assignment;
}

/**
 * Get attendance sheet for a class (Institute) or group (Quran) on a specific date
 */
export async function getAttendanceSheet(req, res, next) {
  try {
    const user = req.session.user;
    const { division, class_id, group_id, subject_id, date } = req.query;

    if (!division || (!class_id && !group_id) || !date) {
      return res.status(400).json({
        success: false,
        error: 'Waaxda, fasalka/halaqada, iyo taariikhda waa qasab.'
      });
    }

    if (user.role === 'institute_admin' && division !== 'institute') {
      return res.status(403).json({ success: false, error: 'Ma lihid ogolaansho waaxda Quraanka.' });
    }
    if (user.role === 'quran_admin' && division !== 'quran') {
      return res.status(403).json({ success: false, error: 'Ma lihid ogolaansho waaxda Machadka.' });
    }
    if (user.division_scope && user.division_scope !== 'all' && user.division_scope !== division) {
      return res.status(403).json({ success: false, error: 'Ma lihid ogolaansho waaxdan.' });
    }

    if (user.role === 'teacher') {
      const allowed = division === 'institute'
        ? await teacherHasInstituteAssignment(user.id, class_id, subject_id)
        : await teacherHasQuranAssignment(user.id, group_id);
      if (!allowed) {
        return res.status(403).json({ success: false, error: 'Ma lihid ogolaansho aad ku hubiso xaadirinta fasalkan iyo maaddadan.' });
      }
    }

    // Calculate day name for records (allows all 7 days Monday - Sunday)
    const selectedDate = new Date(date);
    const dayIndex = selectedDate.getUTCDay();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[dayIndex] || 'Unknown';

    if (division === 'institute') {
      // 1. Get all active enrolled students in this class
      const students = await query(`
        SELECT s.id as student_id, s.student_id as student_code, s.full_name, s.phone, s.gender
        FROM institute_enrollments ie
        JOIN students s ON ie.student_id = s.id
        WHERE ie.class_id = ? AND ie.status = 'active' AND s.is_active = 1
        ORDER BY s.full_name ASC
      `, [class_id]);

      // 2. Check if a session already exists for this class and date
      const [session] = await query(
        `SELECT * FROM institute_class_sessions WHERE class_id = ? AND session_date = ?`,
        [class_id, date]
      );

      let recordedAttendance = [];
      if (session) {
        recordedAttendance = await query(
          `SELECT student_id, status, remarks FROM institute_attendance WHERE session_id = ?`,
          [session.id]
        );
      }

      const attendanceMap = new Map();
      recordedAttendance.forEach(a => attendanceMap.set(a.student_id, a));

      // Build student list with present/absent state
      const sheet = students.map(st => {
        const recorded = attendanceMap.get(st.student_id);
        return {
          ...st,
          status: recorded ? recorded.status : 'present', // default to present per workflow
          remarks: recorded ? recorded.remarks : '',
          is_recorded: !!recorded
        };
      });

      return res.json({
        success: true,
        data: {
          division: 'institute',
          class_id: parseInt(class_id, 10),
          date,
          day_name: dayName,
          session_exists: !!session,
          session_id: session ? session.id : null,
          students: sheet
        }
      });
    } else {
      // Quran division attendance sheet
      const students = await query(`
        SELECT s.id as student_id, s.student_id as student_code, s.full_name, s.phone, s.gender
        FROM quran_enrollments qe
        JOIN students s ON qe.student_id = s.id
        WHERE qe.group_id = ? AND qe.status = 'active' AND s.is_active = 1
        ORDER BY s.full_name ASC
      `, [group_id]);

      const [session] = await query(
        `SELECT * FROM quran_sessions WHERE group_id = ? AND session_date = ?`,
        [group_id, date]
      );

      let recordedAttendance = [];
      if (session) {
        recordedAttendance = await query(
          `SELECT student_id, status, remarks FROM quran_attendance WHERE session_id = ?`,
          [session.id]
        );
      }

      const attendanceMap = new Map();
      recordedAttendance.forEach(a => attendanceMap.set(a.student_id, a));

      const sheet = students.map(st => {
        const recorded = attendanceMap.get(st.student_id);
        return {
          ...st,
          status: recorded ? recorded.status : 'present',
          remarks: recorded ? recorded.remarks : '',
          is_recorded: !!recorded
        };
      });

      return res.json({
        success: true,
        data: {
          division: 'quran',
          group_id: parseInt(group_id, 10),
          date,
          day_name: dayName,
          session_exists: !!session,
          session_id: session ? session.id : null,
          students: sheet
        }
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Save attendance (handles both new creation and authorized correction with audit)
 */
export async function saveAttendance(req, res, next) {
  try {
    const user = req.session.user;
    const { division, class_id, group_id, subject_id, date, records, notes } = req.body;

    if (!division || (!class_id && !group_id) || !date || !Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        error: 'Xogta xaadirintu ma dhammaystirna.'
      });
    }

    // Check division authorization
    if (user.role === 'institute_admin' && division !== 'institute') {
      return res.status(403).json({ success: false, error: 'Ma lihid ogolaansho waaxda Quraanka.' });
    }
    if (user.role === 'quran_admin' && division !== 'quran') {
      return res.status(403).json({ success: false, error: 'Ma lihid ogolaansho waaxda Machadka.' });
    }
    if (user.division_scope && user.division_scope !== 'all' && user.division_scope !== division) {
      return res.status(403).json({ success: false, error: 'Ma lihid ogolaansho waaxdan.' });
    }

    if (user.role === 'teacher') {
      const allowed = division === 'institute'
        ? await teacherHasInstituteAssignment(user.id, class_id, subject_id)
        : await teacherHasQuranAssignment(user.id, group_id);
      if (!allowed) {
        return res.status(403).json({ success: false, error: 'Ma lihid ogolaansho aad ku kaydiso xaadirinta maaddadan.' });
      }
    }

    const selectedDate = new Date(date);
    const dayIndex = selectedDate.getUTCDay();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[dayIndex] || 'Unknown';

    if (division === 'institute') {
      const result = await withTransaction(async (conn) => {
        // Verify every student belongs to the selected class
        const [validEnrollments] = await conn.execute(
          `SELECT student_id FROM institute_enrollments WHERE class_id = ? AND status = 'active'`,
          [class_id]
        );
        const validStudentIds = new Set(validEnrollments.map(e => e.student_id));

        for (const item of records) {
          if (!validStudentIds.has(item.student_id)) {
            const err = new Error(`Ardayga ID-giisu yahay ${item.student_id} kuma qorna fasalkan.`);
            err.statusCode = 400;
            throw err;
          }
        }

        // Find or create class session
        let [sessions] = await conn.execute(
          `SELECT id FROM institute_class_sessions WHERE class_id = ? AND session_date = ?`,
          [class_id, date]
        );

        let sessionId;
        let isCorrection = false;

        if (sessions.length > 0) {
          sessionId = sessions[0].id;
          isCorrection = true;
        } else {
          const [ins] = await conn.execute(
            `INSERT INTO institute_class_sessions (class_id, session_date, day_of_week, recorded_by, notes)
             VALUES (?, ?, ?, ?, ?)`,
            [class_id, date, dayName, user.id, notes || null]
          );
          sessionId = ins.insertId;
        }

        // Upsert attendance for each student (prevents duplicates via UNIQUE KEY uk_inst_att)
        for (const item of records) {
          await conn.execute(
            `INSERT INTO institute_attendance (session_id, student_id, status, remarks, updated_by)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status), remarks = VALUES(remarks), updated_by = VALUES(updated_by)`,
            [sessionId, item.student_id, item.status || 'present', item.remarks || null, user.id]
          );
        }

        return { sessionId, isCorrection };
      });

      await logAudit({
        userId: user.id,
        action: result.isCorrection ? 'CORRECT_ATTENDANCE' : 'RECORD_ATTENDANCE',
        module: 'attendance',
        division: 'institute',
        recordId: result.sessionId,
        details: `${result.isCorrection ? 'Corrected' : 'Recorded'} Institute attendance for class ${class_id} on ${date} (${records.length} students)`,
        ipAddress: req.ip
      });

      return res.json({
        success: true,
        message: result.isCorrection
          ? 'Saxitaanka xaadirinta si guul leh ayaa loo kaydiyay.'
          : 'Xaadirinta si guul leh ayaa loo kaydiyay.',
        session_id: result.sessionId
      });
    } else {
      // Quran attendance save
      const result = await withTransaction(async (conn) => {
        // Verify every student belongs to the selected quran group
        const [validEnrollments] = await conn.execute(
          `SELECT student_id FROM quran_enrollments WHERE group_id = ? AND status = 'active'`,
          [group_id]
        );
        const validStudentIds = new Set(validEnrollments.map(e => e.student_id));

        for (const item of records) {
          if (!validStudentIds.has(item.student_id)) {
            const err = new Error(`Ardayga ID-giisu yahay ${item.student_id} kuma qorna halaqadan.`);
            err.statusCode = 400;
            throw err;
          }
        }

        let [sessions] = await conn.execute(
          `SELECT id FROM quran_sessions WHERE group_id = ? AND session_date = ?`,
          [group_id, date]
        );

        let sessionId;
        let isCorrection = false;

        if (sessions.length > 0) {
          sessionId = sessions[0].id;
          isCorrection = true;
        } else {
          const [ins] = await conn.execute(
            `INSERT INTO quran_sessions (group_id, session_date, recorded_by, notes)
             VALUES (?, ?, ?, ?)`,
            [group_id, date, user.id, notes || null]
          );
          sessionId = ins.insertId;
        }

        for (const item of records) {
          await conn.execute(
            `INSERT INTO quran_attendance (session_id, student_id, status, remarks, updated_by)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status), remarks = VALUES(remarks), updated_by = VALUES(updated_by)`,
            [sessionId, item.student_id, item.status || 'present', item.remarks || null, user.id]
          );
        }

        return { sessionId, isCorrection };
      });

      await logAudit({
        userId: user.id,
        action: result.isCorrection ? 'CORRECT_ATTENDANCE' : 'RECORD_ATTENDANCE',
        module: 'attendance',
        division: 'quran',
        recordId: result.sessionId,
        details: `${result.isCorrection ? 'Corrected' : 'Recorded'} Quran attendance for group ${group_id} on ${date}`,
        ipAddress: req.ip
      });

      return res.json({
        success: true,
        message: result.isCorrection
          ? 'Saxitaanka xaadirinta Quraanka waa la kaydiyay.'
          : 'Xaadirinta Quraanka waa la kaydiyay.',
        session_id: result.sessionId
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Get attendance report by class/group and date range
 */
export async function getAttendanceReport(req, res, next) {
  try {
    const { division, class_id, group_id, start_date, end_date } = req.query;

    if (!division) {
      return res.status(400).json({ success: false, error: 'Fadlan dooro waaxda (division).' });
    }

    if (division === 'institute') {
      let sql = `
        SELECT cs.session_date, cs.day_of_week, ic.name as class_name,
               COUNT(ia.id) as total_students,
               SUM(CASE WHEN ia.status = 'present' THEN 1 ELSE 0 END) as present_count,
               SUM(CASE WHEN ia.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
               u.full_name as recorded_by_name
        FROM institute_class_sessions cs
        JOIN institute_classes ic ON cs.class_id = ic.id
        LEFT JOIN institute_attendance ia ON cs.id = ia.session_id
        LEFT JOIN users u ON cs.recorded_by = u.id
        WHERE 1=1
      `;
      const params = [];
      if (class_id) {
        sql += ` AND cs.class_id = ?`;
        params.push(class_id);
      }
      if (start_date) {
        sql += ` AND cs.session_date >= ?`;
        params.push(start_date);
      }
      if (end_date) {
        sql += ` AND cs.session_date <= ?`;
        params.push(end_date);
      }
      sql += ` GROUP BY cs.id ORDER BY cs.session_date DESC`;

      const rows = await query(sql, params);
      return res.json({ success: true, data: rows });
    } else {
      let sql = `
        SELECT qs.session_date, qg.name as group_name,
               COUNT(qa.id) as total_students,
               SUM(CASE WHEN qa.status = 'present' THEN 1 ELSE 0 END) as present_count,
               SUM(CASE WHEN qa.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
               u.full_name as recorded_by_name
        FROM quran_sessions qs
        JOIN quran_groups qg ON qs.group_id = qg.id
        LEFT JOIN quran_attendance qa ON qs.id = qa.session_id
        LEFT JOIN users u ON qs.recorded_by = u.id
        WHERE 1=1
      `;
      const params = [];
      if (group_id) {
        sql += ` AND qs.group_id = ?`;
        params.push(group_id);
      }
      if (start_date) {
        sql += ` AND qs.session_date >= ?`;
        params.push(start_date);
      }
      if (end_date) {
        sql += ` AND qs.session_date <= ?`;
        params.push(end_date);
      }
      sql += ` GROUP BY qs.id ORDER BY qs.session_date DESC`;

      const rows = await query(sql, params);
      return res.json({ success: true, data: rows });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Search students for attendance across all assigned classes
 * Teachers can search only students within their assigned classes/groups.
 * Supports: full_name (English/Latin), name_ar (Arabic), student_id, phone, guardian_phone.
 */
export async function searchAttendanceStudents(req, res, next) {
  try {
    const user = req.session.user;
    const { q, date, division } = req.query;

    if (!q || !q.trim()) {
      return res.json({ success: true, data: [] });
    }

    const searchTerm = `%${q.trim()}%`;
    const selectedDate = date || new Date().toISOString().split('T')[0];

    // Determine authorized class and group IDs
    let authorizedInstituteClassIds = null;
    let authorizedQuranGroupIds = null;

    if (user.role === 'teacher') {
      const instAssignments = await query(
        `SELECT DISTINCT class_id FROM institute_teacher_assignments WHERE teacher_id = ?`,
        [user.id]
      );
      const timetableAssignments = await query(
        `SELECT DISTINCT class_id FROM institute_timetable WHERE teacher_id = ?`,
        [user.id]
      );
      const instIds = new Set([
        ...instAssignments.map(a => a.class_id),
        ...timetableAssignments.map(a => a.class_id)
      ]);
      authorizedInstituteClassIds = Array.from(instIds);

      const quranAssignments = await query(
        `SELECT DISTINCT group_id FROM quran_teacher_assignments WHERE teacher_id = ?`,
        [user.id]
      );
      authorizedQuranGroupIds = quranAssignments.map(a => a.group_id);

      // If teacher has no assigned classes in either division, return empty list
      if (authorizedInstituteClassIds.length === 0 && authorizedQuranGroupIds.length === 0) {
        return res.json({ success: true, data: [], query: q.trim(), date: selectedDate });
      }
    } else if (user.role === 'institute_admin' || user.division_scope === 'institute') {
      authorizedQuranGroupIds = [];
    } else if (user.role === 'quran_admin' || user.division_scope === 'quran') {
      authorizedInstituteClassIds = [];
    }

    // Build the query conditions
    const whereConditions = [
      's.is_active = 1',
      '(s.full_name LIKE ? OR s.name_ar LIKE ? OR s.student_id LIKE ? OR s.phone LIKE ? OR s.guardian_phone LIKE ?)'
    ];
    const queryParams = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];

    const enrollmentConditions = [];

    // Institute condition
    if (authorizedInstituteClassIds === null) {
      if (!division || division === 'institute') {
        enrollmentConditions.push(
          `s.id IN (SELECT ie.student_id FROM institute_enrollments ie WHERE ie.status = 'active')`
        );
      }
    } else if (authorizedInstituteClassIds.length > 0 && (!division || division === 'institute')) {
      const placeholders = authorizedInstituteClassIds.map(() => '?').join(',');
      enrollmentConditions.push(
        `s.id IN (SELECT ie.student_id FROM institute_enrollments ie WHERE ie.class_id IN (${placeholders}) AND ie.status = 'active')`
      );
      queryParams.push(...authorizedInstituteClassIds);
    }

    // Quran condition
    if (authorizedQuranGroupIds === null) {
      if (!division || division === 'quran') {
        enrollmentConditions.push(
          `s.id IN (SELECT qe.student_id FROM quran_enrollments qe WHERE qe.status = 'active')`
        );
      }
    } else if (authorizedQuranGroupIds.length > 0 && (!division || division === 'quran')) {
      const placeholders = authorizedQuranGroupIds.map(() => '?').join(',');
      enrollmentConditions.push(
        `s.id IN (SELECT qe.student_id FROM quran_enrollments qe WHERE qe.group_id IN (${placeholders}) AND qe.status = 'active')`
      );
      queryParams.push(...authorizedQuranGroupIds);
    }

    if (enrollmentConditions.length === 0) {
      return res.json({ success: true, data: [], query: q.trim(), date: selectedDate });
    }

    whereConditions.push(`(${enrollmentConditions.join(' OR ')})`);

    const studentsSql = `
      SELECT DISTINCT s.id, s.student_id, s.full_name, s.name_ar, s.gender, s.phone,
             s.guardian_name, s.guardian_phone, s.address
      FROM students s
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY s.full_name ASC
      LIMIT 50
    `;

    const students = await query(studentsSql, queryParams);

    if (students.length === 0) {
      return res.json({ success: true, data: [], query: q.trim(), date: selectedDate });
    }

    const studentIds = students.map(st => st.id);
    const idPlaceholders = studentIds.map(() => '?').join(',');

    // Fetch authorized institute enrollments for these students
    let instEnrollments = [];
    if (authorizedInstituteClassIds === null || (Array.isArray(authorizedInstituteClassIds) && authorizedInstituteClassIds.length > 0)) {
      let instSql = `
        SELECT ie.student_id, ie.class_id, ic.name as class_name, ic.academic_year,
               cs.id as session_id, ia.status as attendance_status, ia.remarks as attendance_remarks
        FROM institute_enrollments ie
        JOIN institute_classes ic ON ie.class_id = ic.id
        LEFT JOIN institute_class_sessions cs ON cs.class_id = ie.class_id AND cs.session_date = ?
        LEFT JOIN institute_attendance ia ON ia.session_id = cs.id AND ia.student_id = ie.student_id
        WHERE ie.student_id IN (${idPlaceholders}) AND ie.status = 'active'
      `;
      const instParams = [selectedDate, ...studentIds];
      if (authorizedInstituteClassIds && authorizedInstituteClassIds.length > 0) {
        const clsPlaceholders = authorizedInstituteClassIds.map(() => '?').join(',');
        instSql += ` AND ie.class_id IN (${clsPlaceholders})`;
        instParams.push(...authorizedInstituteClassIds);
      }
      instEnrollments = await query(instSql, instParams);
    }

    // Fetch authorized quran enrollments for these students
    let quranEnrollments = [];
    if (authorizedQuranGroupIds === null || (Array.isArray(authorizedQuranGroupIds) && authorizedQuranGroupIds.length > 0)) {
      let quranSql = `
        SELECT qe.student_id, qe.group_id, qg.name as class_name, qg.shift,
               qs.id as session_id, qa.status as attendance_status, qa.remarks as attendance_remarks
        FROM quran_enrollments qe
        JOIN quran_groups qg ON qe.group_id = qg.id
        LEFT JOIN quran_sessions qs ON qs.group_id = qe.group_id AND qs.session_date = ?
        LEFT JOIN quran_attendance qa ON qa.session_id = qs.id AND qa.student_id = qe.student_id
        WHERE qe.student_id IN (${idPlaceholders}) AND qe.status = 'active'
      `;
      const quranParams = [selectedDate, ...studentIds];
      if (authorizedQuranGroupIds && authorizedQuranGroupIds.length > 0) {
        const grpPlaceholders = authorizedQuranGroupIds.map(() => '?').join(',');
        quranSql += ` AND qe.group_id IN (${grpPlaceholders})`;
        quranParams.push(...authorizedQuranGroupIds);
      }
      quranEnrollments = await query(quranSql, quranParams);
    }

    // Map enrollments and attendance to each student
    const result = students.map(st => {
      const classes = [];

      instEnrollments
        .filter(ie => ie.student_id === st.id)
        .forEach(ie => {
          classes.push({
            division: 'institute',
            class_id: ie.class_id,
            class_name: ie.class_name,
            academic_year: ie.academic_year,
            session_id: ie.session_id || null,
            status: ie.attendance_status || 'not_recorded',
            remarks: ie.attendance_remarks || '',
            has_record: !!ie.attendance_status
          });
        });

      quranEnrollments
        .filter(qe => qe.student_id === st.id)
        .forEach(qe => {
          classes.push({
            division: 'quran',
            group_id: qe.group_id,
            class_id: qe.group_id,
            class_name: qe.class_name,
            shift: qe.shift,
            session_id: qe.session_id || null,
            status: qe.attendance_status || 'not_recorded',
            remarks: qe.attendance_remarks || '',
            has_record: !!qe.attendance_status
          });
        });

      // Primary status for quick display
      const recordedClass = classes.find(c => c.has_record);
      const primaryStatus = recordedClass ? recordedClass.status : 'not_recorded';
      const primaryRemarks = recordedClass ? recordedClass.remarks : '';

      return {
        ...st,
        classes,
        status: primaryStatus,
        remarks: primaryRemarks,
        has_record: !!recordedClass,
        date: selectedDate
      };
    }).filter(st => st.classes.length > 0);

    res.json({ success: true, data: result, query: q.trim(), date: selectedDate });
  } catch (error) {
    next(error);
  }
}

/**
 * Get full attendance history and statistics for a specific student
 * Respects teacher and administrator scoping rules.
 */
export async function getStudentAttendanceHistory(req, res, next) {
  try {
    const user = req.session.user;
    const { student_id } = req.query;

    if (!student_id) {
      return res.status(400).json({ success: false, error: 'Aqoonsiga ardayga (student_id) waa qasab.' });
    }

    const sId = parseInt(student_id, 10);
    const [student] = await query(
      `SELECT id, student_id, full_name, name_ar, gender, phone, guardian_name, guardian_phone FROM students WHERE id = ?`,
      [sId]
    );

    if (!student) {
      return res.status(404).json({ success: false, error: 'Ardayga lama helin.' });
    }

    // Role-based authorization
    if (user.role === 'teacher') {
      const [instAssigned] = await query(`
        SELECT ie.id
        FROM institute_enrollments ie
        JOIN institute_teacher_assignments ita ON ie.class_id = ita.class_id
        WHERE ie.student_id = ? AND ita.teacher_id = ? AND ie.status = 'active'
        LIMIT 1
      `, [sId, user.id]);

      const [quranAssigned] = await query(`
        SELECT qe.id
        FROM quran_enrollments qe
        JOIN quran_teacher_assignments qta ON qe.group_id = qta.group_id
        WHERE qe.student_id = ? AND qta.teacher_id = ? AND qe.status = 'active'
        LIMIT 1
      `, [sId, user.id]);

      if (!instAssigned && !quranAssigned) {
        return res.status(403).json({
          success: false,
          error: 'Ma lihid ogolaansho aad ku aragto taariikhda xaadirinta ardaygan (kuma jiro fasalladaada).'
        });
      }
    } else if (user.role === 'institute_admin' || user.division_scope === 'institute') {
      const [instEnroll] = await query(`SELECT id FROM institute_enrollments WHERE student_id = ? AND status = 'active' LIMIT 1`, [sId]);
      if (!instEnroll) {
        return res.status(403).json({ success: false, error: 'Ardaygan kuma qorna waaxda Machadka.' });
      }
    } else if (user.role === 'quran_admin' || user.division_scope === 'quran') {
      const [quranEnroll] = await query(`SELECT id FROM quran_enrollments WHERE student_id = ? AND status = 'active' LIMIT 1`, [sId]);
      if (!quranEnroll) {
        return res.status(403).json({ success: false, error: 'Ardaygan kuma qorna waaxda Quraanka.' });
      }
    }

    // Query Institute attendance records
    let instRecords = [];
    if (user.role !== 'quran_admin' && user.division_scope !== 'quran') {
      instRecords = await query(`
        SELECT 
          'institute' as division,
          cs.session_date,
          cs.day_of_week,
          ic.name as class_name,
          ia.status,
          ia.remarks,
          ia.updated_at,
          u.full_name as recorded_by_name
        FROM institute_attendance ia
        JOIN institute_class_sessions cs ON ia.session_id = cs.id
        JOIN institute_classes ic ON cs.class_id = ic.id
        LEFT JOIN users u ON cs.recorded_by = u.id
        WHERE ia.student_id = ?
        ORDER BY cs.session_date DESC
      `, [sId]);
    }

    // Query Quran attendance records
    let quranRecords = [];
    if (user.role !== 'institute_admin' && user.division_scope !== 'institute') {
      quranRecords = await query(`
        SELECT 
          'quran' as division,
          qs.session_date,
          DAYNAME(qs.session_date) as day_of_week,
          qg.name as class_name,
          qa.status,
          qa.remarks,
          qa.updated_at,
          u.full_name as recorded_by_name
        FROM quran_attendance qa
        JOIN quran_sessions qs ON qa.session_id = qs.id
        JOIN quran_groups qg ON qs.group_id = qg.id
        LEFT JOIN users u ON qs.recorded_by = u.id
        WHERE qa.student_id = ?
        ORDER BY qs.session_date DESC
      `, [sId]);
    }

    // Combine and sort
    const allRecords = [...instRecords, ...quranRecords].sort((a, b) => {
      return new Date(b.session_date) - new Date(a.session_date);
    });

    const totalSessions = allRecords.length;
    const presentCount = allRecords.filter(r => r.status === 'present').length;
    const absentCount = allRecords.filter(r => r.status === 'absent').length;
    const lateCount = allRecords.filter(r => r.status === 'late').length;
    const excusedCount = allRecords.filter(r => r.status === 'excused').length;
    const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

    res.json({
      success: true,
      data: {
        student,
        summary: {
          total_sessions: totalSessions,
          present_count: presentCount,
          absent_count: absentCount,
          late_count: lateCount,
          excused_count: excusedCount,
          attendance_rate: attendanceRate
        },
        history: allRecords
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Quick single student attendance status & absence reason update
 * Allows teachers to record reasons for missing students directly from search.
 */
export async function updateSingleStudentAttendance(req, res, next) {
  try {
    const user = req.session.user;
    const { student_id, division, class_id, group_id, date, status, remarks } = req.body;

    if (!student_id || !division || (!class_id && !group_id) || !date || !status) {
      return res.status(400).json({
        success: false,
        error: 'Xogta xaadirinta ma dhammaystirna.'
      });
    }

    const validStatuses = ['present', 'absent', 'late', 'excused'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Xaaladda xaadirintu ma saxna. Dooro mid ka mid ah: ${validStatuses.join(', ')}.`
      });
    }

    const sId = parseInt(student_id, 10);
    const targetClassId = class_id ? parseInt(class_id, 10) : null;
    const targetGroupId = group_id ? parseInt(group_id, 10) : null;

    // Check teacher authorization
    if (user.role === 'teacher') {
      if (division === 'institute') {
        const [assign] = await query(`
          SELECT id FROM institute_teacher_assignments WHERE teacher_id = ? AND class_id = ?
        `, [user.id, targetClassId]);
        if (!assign) {
          return res.status(403).json({
            success: false,
            error: 'Ma lihid fasax aad ku qorto xaadirinta fasalkan (Laguguma xilsaarin).'
          });
        }
      } else {
        const [assign] = await query(`
          SELECT id FROM quran_teacher_assignments WHERE teacher_id = ? AND group_id = ?
        `, [user.id, targetGroupId]);
        if (!assign) {
          return res.status(403).json({
            success: false,
            error: 'Ma lihid fasax aad ku qorto xaadirinta halaqadan (Laguguma xilsaarin).'
          });
        }
      }
    } else if (user.role === 'institute_admin' && division !== 'institute') {
      return res.status(403).json({ success: false, error: 'Ma lihid ogolaansho waaxda Quraanka.' });
    } else if (user.role === 'quran_admin' && division !== 'quran') {
      return res.status(403).json({ success: false, error: 'Ma lihid ogolaansho waaxda Machadka.' });
    }

    const selectedDate = new Date(date);
    const dayIndex = selectedDate.getUTCDay();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[dayIndex] || 'Unknown';

    if (division === 'institute') {
      const [enrollment] = await query(`
        SELECT id FROM institute_enrollments WHERE student_id = ? AND class_id = ? AND status = 'active'
      `, [sId, targetClassId]);
      if (!enrollment) {
        return res.status(400).json({ success: false, error: 'Ardaygu kuma qorna fasalkan.' });
      }

      const result = await withTransaction(async (conn) => {
        let [sessions] = await conn.execute(
          `SELECT id FROM institute_class_sessions WHERE class_id = ? AND session_date = ?`,
          [targetClassId, date]
        );

        let sessionId;
        let isCorrection = false;
        if (sessions.length > 0) {
          sessionId = sessions[0].id;
          isCorrection = true;
        } else {
          const [ins] = await conn.execute(
            `INSERT INTO institute_class_sessions (class_id, session_date, day_of_week, recorded_by, notes)
             VALUES (?, ?, ?, ?, ?)`,
            [targetClassId, date, dayName, user.id, null]
          );
          sessionId = ins.insertId;
        }

        await conn.execute(
          `INSERT INTO institute_attendance (session_id, student_id, status, remarks, updated_by)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status = VALUES(status), remarks = VALUES(remarks), updated_by = VALUES(updated_by)`,
          [sessionId, sId, status, remarks || null, user.id]
        );

        return { sessionId, isCorrection };
      });

      await logAudit({
        userId: user.id,
        action: result.isCorrection ? 'CORRECT_ATTENDANCE' : 'RECORD_ATTENDANCE',
        module: 'attendance',
        division: 'institute',
        recordId: result.sessionId,
        details: `${result.isCorrection ? 'Corrected' : 'Recorded'} attendance for student #${sId} in class ${targetClassId} on ${date}: status=${status}, remarks=${remarks || 'none'}`
      });

      return res.json({
        success: true,
        message: 'Xaadirinta ardayga si guul leh ayaa loo kaydiyay.',
        data: {
          student_id: sId,
          class_id: targetClassId,
          division: 'institute',
          date,
          status,
          remarks: remarks || ''
        }
      });
    } else {
      const [enrollment] = await query(`
        SELECT id FROM quran_enrollments WHERE student_id = ? AND group_id = ? AND status = 'active'
      `, [sId, targetGroupId]);
      if (!enrollment) {
        return res.status(400).json({ success: false, error: 'Ardaygu kuma qorna halaqadan.' });
      }

      const result = await withTransaction(async (conn) => {
        let [sessions] = await conn.execute(
          `SELECT id FROM quran_sessions WHERE group_id = ? AND session_date = ?`,
          [targetGroupId, date]
        );

        let sessionId;
        let isCorrection = false;
        if (sessions.length > 0) {
          sessionId = sessions[0].id;
          isCorrection = true;
        } else {
          const [ins] = await conn.execute(
            `INSERT INTO quran_sessions (group_id, session_date, recorded_by, notes)
             VALUES (?, ?, ?, ?)`,
            [targetGroupId, date, user.id, null]
          );
          sessionId = ins.insertId;
        }

        await conn.execute(
          `INSERT INTO quran_attendance (session_id, student_id, status, remarks, updated_by)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status = VALUES(status), remarks = VALUES(remarks), updated_by = VALUES(updated_by)`,
          [sessionId, sId, status, remarks || null, user.id]
        );

        return { sessionId, isCorrection };
      });

      await logAudit({
        userId: user.id,
        action: result.isCorrection ? 'CORRECT_ATTENDANCE' : 'RECORD_ATTENDANCE',
        module: 'attendance',
        division: 'quran',
        recordId: result.sessionId,
        details: `${result.isCorrection ? 'Corrected' : 'Recorded'} Quran attendance for student #${sId} in group ${targetGroupId} on ${date}: status=${status}, remarks=${remarks || 'none'}`
      });

      return res.json({
        success: true,
        message: 'Xaadirinta ardayga si guul leh ayaa loo kaydiyay.',
        data: {
          student_id: sId,
          group_id: targetGroupId,
          division: 'quran',
          date,
          status,
          remarks: remarks || ''
        }
      });
    }
  } catch (error) {
    next(error);
  }
}

