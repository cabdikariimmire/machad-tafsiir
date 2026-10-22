import { query, withTransaction } from '../db/connection.js';
import { logAudit } from '../services/auditService.js';

// ==========================================
// 1. COURSES (Legacy & Reference)
// ==========================================
export async function getCourses(req, res, next) {
  try {
    const courses = await query(`SELECT * FROM institute_courses ORDER BY id ASC`);
    res.json({ success: true, data: courses });
  } catch (error) {
    next(error);
  }
}

export async function createCourse(req, res, next) {
  try {
    const { code, name, description } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, error: 'Koodhka iyo magaca koorsada waa qasab.' });
    }
    const result = await query(
      `INSERT INTO institute_courses (code, name, description) VALUES (?, ?, ?)`,
      [code.trim(), name.trim(), description || null]
    );
    res.status(201).json({ success: true, message: 'Koorsada waa la abuuray.', id: result.insertId });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 2. CLASSES MANAGEMENT
// ==========================================
export async function getClasses(req, res, next) {
  try {
    const user = req.session.user;
    const { search, status } = req.query;
    let sql = `
      SELECT ic.id,
             ic.name as class_name,
             ic.name,
             ic.section,
             ic.academic_year,
             ic.description,
             ic.is_active,
             ic.progression_order,
             ic.is_entry_class,
             ic.is_final_class,
             ic.next_class_id,
             ic.graduation_pass_threshold,
             nc.name as next_class_name,
             CASE WHEN ic.is_active = 1 THEN 'Active' ELSE 'Inactive' END as status,
             ic.course_id,
             ic.created_at,
             ic.updated_at,
             icourse.name as course_name,
             (SELECT COUNT(*) FROM institute_enrollments ie WHERE ie.class_id = ic.id AND ie.status = 'active') as student_count,
             (SELECT COUNT(*) FROM institute_class_subjects ics WHERE ics.class_id = ic.id) as subjects_count
      FROM institute_classes ic
      LEFT JOIN institute_classes nc ON ic.next_class_id = nc.id
      LEFT JOIN institute_courses icourse ON ic.course_id = icourse.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (ic.name LIKE ? OR ic.academic_year LIKE ? OR ic.description LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (status !== undefined && status !== '') {
      if (status === 'active' || status === '1' || status === 1) {
        sql += ` AND ic.is_active = 1`;
      } else if (status === 'inactive' || status === '0' || status === 0) {
        sql += ` AND ic.is_active = 0`;
      }
    }

    // Teachers may only see classes where they have an explicit subject
    // assignment. This also keeps the attendance class selector scoped.
    if (user.role === 'teacher') {
      sql += ` AND EXISTS (
        SELECT 1 FROM institute_teacher_assignments ita
        WHERE ita.teacher_id = ? AND ita.class_id = ic.id
      )`;
      params.push(user.id);
    }

    sql += ` ORDER BY ic.progression_order ASC, ic.id ASC`;
    const classes = await query(sql, params);
    res.json({ success: true, data: classes });
  } catch (error) {
    next(error);
  }
}

export async function createClass(req, res, next) {
  try {
    const className = (req.body.class_name || req.body.name || '').trim();
    const academicYear = (req.body.academic_year || '').trim();
    const description = (req.body.description || '').trim() || null;
    const section = (req.body.section || '').trim() || null;
    const courseId = req.body.course_id || null;
    const progressionOrder = req.body.progression_order !== undefined ? parseInt(req.body.progression_order, 10) : 1;
    const isEntryClass = Boolean(req.body.is_entry_class);
    const isFinalClass = Boolean(req.body.is_final_class);
    let nextClassId = req.body.next_class_id ? Number(req.body.next_class_id) : null;
    const graduationPassThreshold = req.body.graduation_pass_threshold !== undefined && req.body.graduation_pass_threshold !== ''
      ? Number(req.body.graduation_pass_threshold)
      : null;

    if (!className) {
      return res.status(400).json({ success: false, error: 'Magaca fasalka waa qasab (Class Name is required).' });
    }
    if (!academicYear) {
      return res.status(400).json({ success: false, error: 'Sannadka waxbarashada waa qasab (Academic Year is required).' });
    }

    // Class definitions are reusable across academic years. Preserve the
    // existing record instead of creating a yearly duplicate.
    const existing = await query(
      `SELECT id, name, academic_year FROM institute_classes
       WHERE LOWER(TRIM(name)) = LOWER(?)
         AND COALESCE(TRIM(section), '') = COALESCE(TRIM(?), '')
       ORDER BY is_active DESC, id ASC
       LIMIT 1`,
      [className, section]
    );

    if (existing.length > 0) {
      return res.status(200).json({
        success: true,
        reused: true,
        id: existing[0].id,
        message: `Fasalka "${existing[0].name}" horey ayuu u diiwaangashnaa (${existing[0].academic_year}) waxaana loo isticmaalayaa sannadka cusub; duplicate lama abuurin.`
      });
    }

    // Auto-link next class if not explicitly chosen and not final
    if (isFinalClass) {
      nextClassId = null;
    } else if (!nextClassId) {
      const [nextCls] = await query(
        `SELECT id FROM institute_classes
         WHERE is_active = 1 
           AND academic_year = ?
           AND COALESCE(course_id, 0) = COALESCE(?, 0)
           AND COALESCE(section, '') = COALESCE(?, '')
           AND progression_order > ?
         ORDER BY progression_order ASC, id ASC
         LIMIT 1`,
        [academicYear, courseId, section, progressionOrder]
      );
      if (nextCls) {
        nextClassId = nextCls.id;
      }
    }

    const result = await query(
      `INSERT INTO institute_classes (name, section, academic_year, description, course_id, progression_order, is_entry_class, is_final_class, next_class_id, graduation_pass_threshold, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [className, section, academicYear, description, courseId, progressionOrder, isEntryClass, isFinalClass, nextClassId, graduationPassThreshold]
    );

    // Auto-link any previous lower-order class in the same academic year/course/section that has no next_class_id yet
    if (!isEntryClass) {
      const [prevCls] = await query(
        `SELECT id FROM institute_classes
         WHERE is_active = 1 
           AND academic_year = ?
           AND COALESCE(course_id, 0) = COALESCE(?, 0)
           AND COALESCE(section, '') = COALESCE(?, '')
           AND is_final_class = 0 
           AND next_class_id IS NULL 
           AND progression_order < ?
         ORDER BY progression_order DESC, id DESC
         LIMIT 1`,
        [academicYear, courseId, section, progressionOrder]
      );
      if (prevCls) {
        await query(`UPDATE institute_classes SET next_class_id = ? WHERE id = ?`, [result.insertId, prevCls.id]);
      }
    }

    await logAudit({
      userId: req.user?.id,
      action: 'create_class',
      module: 'institute',
      division: 'institute',
      recordId: result.insertId,
      details: { class_name: className, academic_year: academicYear, progression_order: progressionOrder, is_final_class: isFinalClass }
    });

    res.status(201).json({
      success: true,
      message: `Fasalka "${className}" si guul leh ayaa loo abuuray.`,
      id: result.insertId
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Fasal leh magacan iyo sannadkan horey ayuu u jiray.'
      });
    }
    next(error);
  }
}

export async function updateClass(req, res, next) {
  try {
    const { id } = req.params;
    const className = (req.body.class_name || req.body.name || '').trim();
    const academicYear = (req.body.academic_year || '').trim();
    const description = req.body.description !== undefined ? (req.body.description?.trim() || null) : undefined;
    const section = req.body.section !== undefined ? (req.body.section?.trim() || null) : undefined;
    const courseId = req.body.course_id !== undefined ? (req.body.course_id || null) : undefined;
    const isActive = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : undefined;
    const progressionOrder = req.body.progression_order !== undefined ? parseInt(req.body.progression_order, 10) : undefined;
    const isEntryClass = req.body.is_entry_class !== undefined ? (req.body.is_entry_class ? 1 : 0) : undefined;
    const isFinalClass = req.body.is_final_class !== undefined ? (req.body.is_final_class ? 1 : 0) : undefined;
    const nextClassId = req.body.next_class_id !== undefined ? (req.body.next_class_id ? Number(req.body.next_class_id) : null) : undefined;
    const graduationPassThreshold = req.body.graduation_pass_threshold !== undefined
      ? (req.body.graduation_pass_threshold === '' ? null : Number(req.body.graduation_pass_threshold))
      : undefined;

    const [existingClass] = await query(`SELECT * FROM institute_classes WHERE id = ?`, [id]);
    if (!existingClass) {
      return res.status(404).json({ success: false, error: 'Fasalka lama helin.' });
    }

    const targetName = className || existingClass.name;
    const targetYear = academicYear || existingClass.academic_year;

    // Check duplicate name in same academic year excluding this class
    const duplicate = await query(
      `SELECT id FROM institute_classes WHERE LOWER(TRIM(name)) = LOWER(?) AND academic_year = ? AND id != ?`,
      [targetName, targetYear, id]
    );

    if (duplicate.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Fasal kale oo leh magaca "${targetName}" ayaa horey ugu jira sannadka ${targetYear}.`
      });
    }

    const updateFields = [
      'name = ?',
      'academic_year = ?',
      'description = COALESCE(?, description)',
      'section = COALESCE(?, section)',
      'course_id = COALESCE(?, course_id)',
      'is_active = COALESCE(?, is_active)',
      'progression_order = COALESCE(?, progression_order)',
      'is_entry_class = COALESCE(?, is_entry_class)',
      'is_final_class = COALESCE(?, is_final_class)',
      'graduation_pass_threshold = COALESCE(?, graduation_pass_threshold)'
    ];
    const updateParams = [
      targetName,
      targetYear,
      description,
      section,
      courseId,
      isActive,
      progressionOrder,
      isEntryClass,
      isFinalClass,
      graduationPassThreshold
    ];

    if (isFinalClass === 1) {
      updateFields.push('next_class_id = NULL');
    } else if (nextClassId !== undefined) {
      updateFields.push('next_class_id = ?');
      updateParams.push(nextClassId);
    }

    updateParams.push(id);
    await query(
      `UPDATE institute_classes
       SET ${updateFields.join(', ')},
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      updateParams
    );

    await logAudit({
      userId: req.user?.id,
      action: 'update_class',
      module: 'institute',
      division: 'institute',
      recordId: id,
      details: { name: targetName, academic_year: targetYear }
    });

    res.json({ success: true, message: 'Macluumaadka fasalka waa la cusboonaysiiyay.' });
  } catch (error) {
    next(error);
  }
}

export async function toggleClassStatus(req, res, next) {
  try {
    const { id } = req.params;
    const [cls] = await query(`SELECT id, name, is_active FROM institute_classes WHERE id = ?`, [id]);
    if (!cls) {
      return res.status(404).json({ success: false, error: 'Fasalka lama helin.' });
    }

    const newStatus = cls.is_active === 1 ? 0 : 1;
    await query(`UPDATE institute_classes SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, id]);

    await logAudit({
      userId: req.user?.id,
      action: newStatus === 1 ? 'activate_class' : 'deactivate_class',
      module: 'institute',
      division: 'institute',
      recordId: id,
      details: { class_name: cls.name, new_status: newStatus }
    });

    res.json({
      success: true,
      message: newStatus === 1 ? `Fasalka "${cls.name}" waa la hawlgeliyay (Active).` : `Fasalka "${cls.name}" waa la xidhay (Inactive).`,
      is_active: newStatus,
      status: newStatus === 1 ? 'Active' : 'Inactive'
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteClass(req, res, next) {
  try {
    const { id } = req.params;
    const [cls] = await query(`SELECT id, name FROM institute_classes WHERE id = ?`, [id]);
    if (!cls) {
      return res.status(404).json({ success: false, error: 'Fasalka lama helin.' });
    }

    // Check associated records: enrollments, timetable, attendance
    const [enrollments] = await query(`SELECT COUNT(*) as count FROM institute_enrollments WHERE class_id = ?`, [id]);
    const [timetable] = await query(`SELECT COUNT(*) as count FROM institute_timetable WHERE class_id = ?`, [id]);

    if (enrollments.count > 0 || timetable.count > 0) {
      return res.status(400).json({
        success: false,
        error: `Fasalkan si toos ah looma tiri karo sababtoo ah wuxuu leeyahay xog la xidhiidha (${enrollments.count} arday, ${timetable.count} jadwalka). Fadlan isticmaal deactivation (Inactive) halkii aad ka tiri lahayd.`
      });
    }

    await query(`DELETE FROM institute_class_subjects WHERE class_id = ?`, [id]);
    await query(`DELETE FROM institute_classes WHERE id = ?`, [id]);

    await logAudit({
      userId: req.user?.id,
      action: 'delete_class',
      module: 'institute',
      division: 'institute',
      recordId: id,
      details: { class_name: cls.name }
    });

    res.json({ success: true, message: `Fasalka "${cls.name}" si buuxda ayaa loo tiray.` });
  } catch (error) {
    next(error);
  }
}

export async function getClassStudents(req, res, next) {
  try {
    const { id } = req.params;
    const students = await query(`
      SELECT s.id, s.student_id, s.full_name, s.phone, s.gender, ie.enrollment_date, ie.status
      FROM institute_enrollments ie
      JOIN students s ON ie.student_id = s.id
      WHERE ie.class_id = ? AND ie.status = 'active' AND s.is_active = 1
      ORDER BY s.full_name ASC
    `, [id]);
    res.json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 3. SUBJECTS MANAGEMENT (Centrally Managed)
// ==========================================
export async function getSubjects(req, res, next) {
  try {
    const { course_id, search, status } = req.query;
    let sql = `
      SELECT s.id,
             s.name as subject_name,
             s.name,
             s.code as subject_code,
             s.code,
             s.description,
             s.is_active,
             CASE WHEN s.is_active = 1 THEN 'Active' ELSE 'Inactive' END as status,
             s.course_id,
             s.created_at,
             s.updated_at,
             c.name as course_name,
             (SELECT COUNT(*) FROM institute_class_subjects ics WHERE ics.subject_id = s.id) as classes_count
      FROM institute_subjects s 
      LEFT JOIN institute_courses c ON s.course_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (course_id) {
      sql += ` AND s.course_id = ?`;
      params.push(course_id);
    }

    if (search) {
      sql += ` AND (s.name LIKE ? OR s.code LIKE ? OR s.description LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (status !== undefined && status !== '') {
      if (status === 'active' || status === '1' || status === 1) {
        sql += ` AND s.is_active = 1`;
      } else if (status === 'inactive' || status === '0' || status === 0) {
        sql += ` AND s.is_active = 0`;
      }
    }

    sql += ` ORDER BY s.id ASC`;
    const subjects = await query(sql, params);
    res.json({ success: true, data: subjects });
  } catch (error) {
    next(error);
  }
}

export async function createSubject(req, res, next) {
  try {
    const subjectName = (req.body.subject_name || req.body.name || '').trim();
    let subjectCode = (req.body.subject_code || req.body.code || '').trim();
    const description = (req.body.description || '').trim() || null;
    const courseId = req.body.course_id || null;

    if (!subjectName) {
      return res.status(400).json({ success: false, error: 'Magaca maaddada waa qasab (Subject Name is required).' });
    }

    // Auto-generate code if empty
    if (!subjectCode) {
      const slug = subjectName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'SUB');
      const [count] = await query(`SELECT COUNT(*) as cnt FROM institute_subjects`);
      subjectCode = `SUB-${slug}${(count.cnt + 1).toString().padStart(2, '0')}`;
    }

    // Check code uniqueness
    const existingCode = await query(`SELECT id FROM institute_subjects WHERE LOWER(code) = LOWER(?)`, [subjectCode]);
    if (existingCode.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Koodhka maaddada "${subjectCode}" horey ayaa loo isticmaalay. Fadlan dooro koodh kale.`
      });
    }

    const result = await query(
      `INSERT INTO institute_subjects (course_id, code, name, description, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [courseId, subjectCode, subjectName, description]
    );

    await logAudit({
      userId: req.user?.id,
      action: 'create_subject',
      module: 'institute',
      division: 'institute',
      recordId: result.insertId,
      details: { subject_name: subjectName, subject_code: subjectCode }
    });

    res.status(201).json({
      success: true,
      message: `Maaddada "${subjectName}" si guul leh ayaa loo diiwaangeliyay.`,
      id: result.insertId
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: 'Maaddo leh koodhkan horey ayay u jirtay.' });
    }
    next(error);
  }
}

export async function updateSubject(req, res, next) {
  try {
    const { id } = req.params;
    const subjectName = (req.body.subject_name || req.body.name || '').trim();
    const subjectCode = (req.body.subject_code || req.body.code || '').trim();
    const description = req.body.description !== undefined ? (req.body.description?.trim() || null) : undefined;
    const courseId = req.body.course_id !== undefined ? (req.body.course_id || null) : undefined;
    const isActive = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : undefined;

    const [existingSub] = await query(`SELECT * FROM institute_subjects WHERE id = ?`, [id]);
    if (!existingSub) {
      return res.status(404).json({ success: false, error: 'Maaddada lama helin.' });
    }

    const targetName = subjectName || existingSub.name;
    const targetCode = subjectCode || existingSub.code;

    // Check unique code
    if (targetCode) {
      const duplicate = await query(
        `SELECT id FROM institute_subjects WHERE LOWER(code) = LOWER(?) AND id != ?`,
        [targetCode, id]
      );
      if (duplicate.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Koodhka maaddada "${targetCode}" waxaa horey u isticmaalay maaddo kale.`
        });
      }
    }

    await query(
      `UPDATE institute_subjects
       SET name = ?,
           code = ?,
           description = COALESCE(?, description),
           course_id = COALESCE(?, course_id),
           is_active = COALESCE(?, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [targetName, targetCode, description, courseId, isActive, id]
    );

    await logAudit({
      userId: req.user?.id,
      action: 'update_subject',
      module: 'institute',
      division: 'institute',
      recordId: id,
      details: { subject_name: targetName, subject_code: targetCode }
    });

    res.json({ success: true, message: 'Macluumaadka maaddada waa la cusboonaysiiyay.' });
  } catch (error) {
    next(error);
  }
}

export async function toggleSubjectStatus(req, res, next) {
  try {
    const { id } = req.params;
    const [sub] = await query(`SELECT id, name, is_active FROM institute_subjects WHERE id = ?`, [id]);
    if (!sub) {
      return res.status(404).json({ success: false, error: 'Maaddada lama helin.' });
    }

    const newStatus = sub.is_active === 1 ? 0 : 1;
    await query(`UPDATE institute_subjects SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, id]);

    await logAudit({
      userId: req.user?.id,
      action: newStatus === 1 ? 'activate_subject' : 'deactivate_subject',
      module: 'institute',
      division: 'institute',
      recordId: id,
      details: { subject_name: sub.name, new_status: newStatus }
    });

    res.json({
      success: true,
      message: newStatus === 1 ? `Maaddada "${sub.name}" waa la hawlgeliyay (Active).` : `Maaddada "${sub.name}" waa la xidhay (Inactive).`,
      is_active: newStatus,
      status: newStatus === 1 ? 'Active' : 'Inactive'
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteSubject(req, res, next) {
  try {
    const { id } = req.params;
    const [sub] = await query(`SELECT id, name FROM institute_subjects WHERE id = ?`, [id]);
    if (!sub) {
      return res.status(404).json({ success: false, error: 'Maaddada lama helin.' });
    }

    const [classAssoc] = await query(`SELECT COUNT(*) as count FROM institute_class_subjects WHERE subject_id = ?`, [id]);
    const [timetableAssoc] = await query(`SELECT COUNT(*) as count FROM institute_timetable WHERE subject_id = ?`, [id]);

    if (classAssoc.count > 0 || timetableAssoc.count > 0) {
      return res.status(400).json({
        success: false,
        error: `Maaddadan lama tiri karo sababtoo ah waxay ku xidhan tahay fasallo (${classAssoc.count}) ama jadwalka (${timetableAssoc.count}). Fadlan ku beddel Inactive si aad u ilaaliso diiwaanka waxbarashada.`
      });
    }

    await query(`DELETE FROM institute_subjects WHERE id = ?`, [id]);

    await logAudit({
      userId: req.user?.id,
      action: 'delete_subject',
      module: 'institute',
      division: 'institute',
      recordId: id,
      details: { subject_name: sub.name }
    });

    res.json({ success: true, message: `Maaddada "${sub.name}" waa la tiray.` });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 4. CLASS SUBJECTS ASSIGNMENT (Many-to-Many)
// ==========================================
export async function getClassSubjects(req, res, next) {
  try {
    const { id } = req.params;
    const [cls] = await query(`SELECT id, name, academic_year, is_active FROM institute_classes WHERE id = ?`, [id]);
    if (!cls) {
      return res.status(404).json({ success: false, error: 'Fasalka lama helin.' });
    }

    // Currently assigned subjects
    const assigned = await query(`
      SELECT s.id, s.code, s.name, s.name as subject_name, s.code as subject_code,
             s.description, s.is_active, ics.created_at as assigned_at
      FROM institute_class_subjects ics
      JOIN institute_subjects s ON ics.subject_id = s.id
      WHERE ics.class_id = ?
      ORDER BY s.name ASC
    `, [id]);

    // Available active subjects that are not yet assigned to this class
    const available = await query(`
      SELECT s.id, s.code, s.name, s.name as subject_name, s.code as subject_code,
             s.description, s.is_active
      FROM institute_subjects s
      WHERE s.is_active = 1
        AND s.id NOT IN (SELECT subject_id FROM institute_class_subjects WHERE class_id = ?)
      ORDER BY s.name ASC
    `, [id]);

    res.json({
      success: true,
      class: cls,
      data: assigned,
      available
    });
  } catch (error) {
    next(error);
  }
}

export async function assignClassSubjects(req, res, next) {
  try {
    const { id } = req.params;
    const { subject_ids, subject_id } = req.body;

    const [cls] = await query(`SELECT id, name FROM institute_classes WHERE id = ?`, [id]);
    if (!cls) {
      return res.status(404).json({ success: false, error: 'Fasalka lama helin.' });
    }

    let ids = [];
    if (Array.isArray(subject_ids)) {
      ids = subject_ids.map(Number).filter(Boolean);
    } else if (subject_id) {
      ids = [Number(subject_id)];
    }

    if (ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Fadlan dooro ugu yaraan hal maaddo.' });
    }

    // Verify all selected subjects are active
    const subjects = await query(
      `SELECT id, name, is_active FROM institute_subjects WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );

    const inactive = subjects.filter(s => s.is_active === 0);
    if (inactive.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Maaddada "${inactive[0].name}" ma shaqaynayso (waa Inactive) lamana xilsaari karo fasal.`
      });
    }

    // Insert assignments ignoring existing ones to avoid duplicate errors
    for (const sid of ids) {
      await query(
        `INSERT IGNORE INTO institute_class_subjects (class_id, subject_id) VALUES (?, ?)`,
        [id, sid]
      );
    }

    await logAudit({
      userId: req.user?.id,
      action: 'assign_class_subjects',
      module: 'institute',
      division: 'institute',
      recordId: id,
      details: { class_name: cls.name, assigned_subjects_count: ids.length }
    });

    res.status(201).json({
      success: true,
      message: `Maaddooyinka si guul leh ayaa loogu daray fasalka "${cls.name}".`
    });
  } catch (error) {
    next(error);
  }
}

export async function removeClassSubject(req, res, next) {
  try {
    const { id, subject_id } = req.params;

    const [cls] = await query(`SELECT id, name FROM institute_classes WHERE id = ?`, [id]);
    const [sub] = await query(`SELECT id, name FROM institute_subjects WHERE id = ?`, [subject_id]);

    if (!cls || !sub) {
      return res.status(404).json({ success: false, error: 'Fasalka ama maaddada lama helin.' });
    }

    // Safe check: Is this subject currently in use in timetable for this class?
    const [timetableCount] = await query(
      `SELECT COUNT(*) as count FROM institute_timetable WHERE class_id = ? AND subject_id = ?`,
      [id, subject_id]
    );

    if (timetableCount.count > 0) {
      return res.status(400).json({
        success: false,
        error: `Maaddada "${sub.name}" waxaa ku qoran ${timetableCount.count} cashar oo jadwalka fasalkan ku jira. Fadlan marka hore ka saar jadwalka.`
      });
    }

    await query(`DELETE FROM institute_class_subjects WHERE class_id = ? AND subject_id = ?`, [id, subject_id]);

    await logAudit({
      userId: req.user?.id,
      action: 'remove_class_subject',
      module: 'institute',
      division: 'institute',
      recordId: id,
      details: { class_name: cls.name, subject_name: sub.name }
    });

    res.json({
      success: true,
      message: `Maaddada "${sub.name}" waa laga saaray fasalka "${cls.name}".`
    });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 5. TIMETABLE MANAGEMENT (All 7 Weekdays)
// ==========================================
const VALID_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export async function getTimetable(req, res, next) {
  try {
    const { class_id, day_of_week } = req.query;
    let sql = `
      SELECT tt.id,
             tt.class_id,
             tt.subject_id,
             tt.teacher_id,
             tt.day_of_week,
             tt.start_time,
             tt.end_time,
             tt.room,
             tt.notes,
             tt.created_at,
             tt.updated_at,
             ic.name as class_name,
             isub.name as subject_name,
             isub.code as subject_code,
             u.full_name as teacher_name
      FROM institute_timetable tt
      JOIN institute_classes ic ON tt.class_id = ic.id
      JOIN institute_subjects isub ON tt.subject_id = isub.id
      LEFT JOIN users u ON tt.teacher_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (class_id) {
      sql += ` AND tt.class_id = ?`;
      params.push(class_id);
    }

    if (day_of_week) {
      sql += ` AND tt.day_of_week = ?`;
      params.push(day_of_week);
    }

    sql += ` ORDER BY FIELD(tt.day_of_week, 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'), tt.start_time ASC`;
    const schedule = await query(sql, params);
    res.json({ success: true, data: schedule });
  } catch (error) {
    next(error);
  }
}

export async function createTimetableEntry(req, res, next) {
  try {
    const { class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room, notes } = req.body;

    // 1. Validate required fields
    if (!class_id || !subject_id || !day_of_week || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        error: 'Fasalka, maaddada, maalinta, saacadda bilaabashada, iyo saacadda dhamaadka waa qasab.'
      });
    }

    // 2. Validate day of week (all 7 days supported)
    if (!VALID_DAYS.includes(day_of_week)) {
      return res.status(400).json({
        success: false,
        error: `Maalinta "${day_of_week}" ma saxna. Maalmaha la oggol yahay: ${VALID_DAYS.join(', ')}.`
      });
    }

    // 3. Validate end_time > start_time
    const sTime = start_time.length === 5 ? `${start_time}:00` : start_time;
    const eTime = end_time.length === 5 ? `${end_time}:00` : end_time;

    if (eTime <= sTime) {
      return res.status(400).json({
        success: false,
        error: `Saacadda dhamaadku (${end_time.slice(0, 5)}) waa inay ka dambaysaa saacadda bilaabashada (${start_time.slice(0, 5)}).`
      });
    }

    // 4. Verify class exists and is active
    const [cls] = await query(`SELECT id, name, is_active FROM institute_classes WHERE id = ?`, [class_id]);
    if (!cls) {
      return res.status(404).json({ success: false, error: 'Fasalka lama helin.' });
    }

    // 5. Verify subject exists, is active, and is assigned to the class
    const [sub] = await query(`SELECT id, name, is_active FROM institute_subjects WHERE id = ?`, [subject_id]);
    if (!sub) {
      return res.status(404).json({ success: false, error: 'Maaddada lama helin.' });
    }
    if (sub.is_active === 0) {
      return res.status(400).json({
        success: false,
        error: `Maaddada "${sub.name}" ma shaqaynayso (waa Inactive) lamana gelin karo jadwalka.`
      });
    }

    const [assignment] = await query(
      `SELECT id FROM institute_class_subjects WHERE class_id = ? AND subject_id = ?`,
      [class_id, subject_id]
    );

    if (!assignment) {
      return res.status(400).json({
        success: false,
        error: `Maaddada "${sub.name}" looma xilsaarin fasalka "${cls.name}". Fadlan marka hore ku dar maaddooyinka fasalka.`
      });
    }

    // 6. Check for overlapping timetable entries for the SAME class on the SAME day
    const conflicts = await query(
      `SELECT tt.id, tt.start_time, tt.end_time, isub.name as subject_name
       FROM institute_timetable tt
       JOIN institute_subjects isub ON tt.subject_id = isub.id
       WHERE tt.class_id = ?
         AND tt.day_of_week = ?
         AND (tt.start_time < ? AND tt.end_time > ?)`,
      [class_id, day_of_week, eTime, sTime]
    );

    if (conflicts.length > 0) {
      const conf = conflicts[0];
      return res.status(400).json({
        success: false,
        error: `Isku dhac waqti (Schedule Conflict): Fasalka "${cls.name}" wuxuu horey u leeyahay darsi (${conf.subject_name}) maalinta ${day_of_week} saacadaha ${conf.start_time.slice(0, 5)} - ${conf.end_time.slice(0, 5)}. Fadlan dooro waqti kale.`
      });
    }

    const result = await query(
      `INSERT INTO institute_timetable (class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [class_id, subject_id, teacher_id || null, day_of_week, sTime, eTime, room || null, notes || null]
    );

    await logAudit({
      userId: req.user?.id,
      action: 'create_timetable_entry',
      module: 'institute',
      division: 'institute',
      recordId: result.insertId,
      details: { class_name: cls.name, subject_name: sub.name, day_of_week, start_time: sTime, end_time: eTime }
    });

    res.status(201).json({
      success: true,
      message: `Darsiga jadwalka si guul leh ayaa loo kaydiyay.`,
      id: result.insertId
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTimetableEntry(req, res, next) {
  try {
    const { id } = req.params;
    const { class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room, notes } = req.body;

    const [existing] = await query(`SELECT * FROM institute_timetable WHERE id = ?`, [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Darsiga jadwalka lama helin.' });
    }

    const targetClassId = class_id || existing.class_id;
    const targetSubjectId = subject_id || existing.subject_id;
    const targetDay = day_of_week || existing.day_of_week;
    let sTime = start_time || existing.start_time;
    let eTime = end_time || existing.end_time;

    if (typeof sTime === 'string' && sTime.length === 5) sTime = `${sTime}:00`;
    if (typeof eTime === 'string' && eTime.length === 5) eTime = `${eTime}:00`;

    if (!VALID_DAYS.includes(targetDay)) {
      return res.status(400).json({
        success: false,
        error: `Maalinta "${targetDay}" ma saxna. Maalmaha la oggol yahay: ${VALID_DAYS.join(', ')}.`
      });
    }

    if (eTime <= sTime) {
      return res.status(400).json({
        success: false,
        error: `Saacadda dhamaadku waa inay ka dambaysaa saacadda bilaabashada.`
      });
    }

    // Verify class and subject assignment
    const [sub] = await query(`SELECT id, name, is_active FROM institute_subjects WHERE id = ?`, [targetSubjectId]);
    if (!sub || sub.is_active === 0) {
      return res.status(400).json({ success: false, error: 'Maaddadani ma shaqaynayso (Inactive).' });
    }

    const [assignment] = await query(
      `SELECT id FROM institute_class_subjects WHERE class_id = ? AND subject_id = ?`,
      [targetClassId, targetSubjectId]
    );

    if (!assignment) {
      return res.status(400).json({
        success: false,
        error: `Maaddada looma xilsaarin fasalkan.`
      });
    }

    // Overlap conflict check excluding this entry
    const conflicts = await query(
      `SELECT tt.id, tt.start_time, tt.end_time, isub.name as subject_name
       FROM institute_timetable tt
       JOIN institute_subjects isub ON tt.subject_id = isub.id
       WHERE tt.class_id = ?
         AND tt.day_of_week = ?
         AND (tt.start_time < ? AND tt.end_time > ?)
         AND tt.id != ?`,
      [targetClassId, targetDay, eTime, sTime, id]
    );

    if (conflicts.length > 0) {
      const conf = conflicts[0];
      return res.status(400).json({
        success: false,
        error: `Isku dhac waqti: Fasalkani wuxuu horey u leeyahay darsi (${conf.subject_name}) maalinta ${targetDay} saacadaha ${conf.start_time.slice(0, 5)} - ${conf.end_time.slice(0, 5)}.`
      });
    }

    await query(
      `UPDATE institute_timetable
       SET class_id = ?,
           subject_id = ?,
           teacher_id = ?,
           day_of_week = ?,
           start_time = ?,
           end_time = ?,
           room = ?,
           notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [targetClassId, targetSubjectId, teacher_id || null, targetDay, sTime, eTime, room || null, notes || null, id]
    );

    res.json({ success: true, message: 'Darsiga jadwalka waa la cusboonaysiiyay.' });
  } catch (error) {
    next(error);
  }
}

export async function deleteTimetableEntry(req, res, next) {
  try {
    const { id } = req.params;
    const [existing] = await query(`SELECT id FROM institute_timetable WHERE id = ?`, [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Darsiga jadwalka lama helin.' });
    }

    await query(`DELETE FROM institute_timetable WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Darsiga waa laga saaray jadwalka.' });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// 6. TEACHER ASSIGNMENTS (Legacy & Read-Only)
// ==========================================
export async function getTeacherAssignments(req, res, next) {
  try {
    const user = req.session.user;
    let sql = `
      SELECT ita.*, u.full_name as teacher_name, ic.name as class_name, isub.name as subject_name
      FROM institute_teacher_assignments ita
      JOIN users u ON ita.teacher_id = u.id
      JOIN institute_classes ic ON ita.class_id = ic.id
      JOIN institute_subjects isub ON ita.subject_id = isub.id
    `;
    const params = [];
    if (user.role === 'teacher') {
      sql += ` WHERE ita.teacher_id = ?`;
      params.push(user.id);
    }
    sql += ` ORDER BY u.full_name ASC, ic.name ASC, isub.name ASC`;
    const assignments = await query(sql, params);
    res.json({ success: true, data: assignments });
  } catch (error) {
    next(error);
  }
}

export async function createTeacherAssignment(req, res, next) {
  try {
    const { teacher_id, class_id, subject_id } = req.body;
    if (!teacher_id || !class_id || !subject_id) {
      return res.status(400).json({ success: false, error: 'Macallinka, fasalka, iyo maaddada waa qasab.' });
    }

    const [teacher] = await query(`
      SELECT u.id FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = ? AND r.name = 'teacher'
    `, [teacher_id]);
    if (!teacher) {
      return res.status(400).json({ success: false, error: 'Isticmaalaha la doortay ma aha macallin.' });
    }

    const [classSubject] = await query(
      `SELECT id FROM institute_class_subjects WHERE class_id = ? AND subject_id = ?`,
      [class_id, subject_id]
    );
    if (!classSubject) {
      return res.status(400).json({ success: false, error: 'Maaddada looma xilsaarin fasalkan.' });
    }

    await query(
      `INSERT INTO institute_teacher_assignments (teacher_id, class_id, subject_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
      [teacher_id, class_id, subject_id]
    );

    res.status(201).json({ success: true, message: 'Macallinka si guul leh ayaa loogu qoray fasalka.' });
  } catch (error) {
    next(error);
  }
}

export async function deleteTeacherAssignment(req, res, next) {
  try {
    const { id } = req.params;
    const [assignment] = await query(`SELECT id FROM institute_teacher_assignments WHERE id = ?`, [id]);
    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Xilsaarka macallinka lama helin.' });
    }
    await query(`DELETE FROM institute_teacher_assignments WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Xilsaarka macallinka waa laga saaray.' });
  } catch (error) {
    next(error);
  }
}

export async function getInstituteTeachers(req, res, next) {
  try {
    const teachers = await query(`
      SELECT u.id, u.full_name, u.username, u.phone, u.email, u.is_active
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'teacher'
        AND (u.division_scope IN ('institute', 'all') OR u.division_scope IS NULL)
      ORDER BY u.full_name ASC
    `);
    res.json({ success: true, data: teachers });
  } catch (error) {
    next(error);
  }
}
