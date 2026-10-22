import { query, withTransaction } from '../db/connection.js';
import { SURAHS_DATA, JUZ_DATA } from '../constants/quranMetadata.js';
import { logAudit } from './auditService.js';

// Pre-computed map: "surah:verse" -> juz_number
const VERSE_TO_JUZ_MAP = new Map();
for (const s of SURAHS_DATA) {
  for (let v = 1; v <= s.total_verses; v++) {
    const juz = JUZ_DATA.find(j => {
      const afterStart = s.number > j.start_surah || (s.number === j.start_surah && v >= j.start_verse);
      const beforeEnd = s.number < j.end_surah || (s.number === j.end_surah && v <= j.end_verse);
      return afterStart && beforeEnd;
    });
    if (juz) {
      VERSE_TO_JUZ_MAP.set(`${s.number}:${v}`, juz.juz_number);
    }
  }
}

/**
 * Get all 114 Surahs with metadata
 */
export async function getAllSurahs() {
  const surahs = await query(`SELECT * FROM quran_surahs ORDER BY number ASC`);
  return surahs;
}

/**
 * Get all 30 Juz with metadata
 */
export async function getAllJuz() {
  const juz = await query(`SELECT * FROM quran_juz ORDER BY juz_number ASC`);
  if (!juz || juz.length === 0) {
    return JUZ_DATA;
  }
  return juz;
}

/**
 * Check if a teacher is assigned to a specific group
 */
export async function isTeacherAssignedToGroup(teacherId, groupId) {
  const [assignment] = await query(
    `SELECT id FROM quran_teacher_assignments WHERE teacher_id = ? AND group_id = ?`,
    [teacherId, groupId]
  );
  return !!assignment;
}

/**
 * Get groups assigned to a teacher
 */
export async function getTeacherGroups(teacherId) {
  const groups = await query(`
    SELECT qg.*, ql.name as level_name,
           (SELECT COUNT(*) FROM quran_enrollments qe WHERE qe.group_id = qg.id AND qe.status = 'active') as student_count,
           u.id as assigned_teacher_id,
           u.full_name as assigned_teachers,
           u.full_name as assigned_teacher_name,
           u.phone as assigned_teacher_phone
    FROM quran_groups qg
    JOIN quran_teacher_assignments qta ON qta.group_id = qg.id
    LEFT JOIN users u ON qta.teacher_id = u.id
    LEFT JOIN quran_levels ql ON qg.level_id = ql.id
    WHERE qta.teacher_id = ?
    ORDER BY qg.id ASC
  `, [teacherId]);
  return groups;
}

/**
 * Get verses of a Surah with memorization status for a specific student
 */
export async function getSurahVersesForStudent(studentId, surahNumber) {
  const num = parseInt(surahNumber, 10);
  const [surah] = await query(`SELECT * FROM quran_surahs WHERE number = ?`, [num]);
  if (!surah) {
    throw new Error('Suuradda lama helin.');
  }

  // Get student's memorized verses for this Surah
  const memorizedRows = await query(
    `SELECT verse_number, memorized_date, is_memorized 
     FROM quran_verse_memorization 
     WHERE student_id = ? AND surah_number = ? AND is_memorized = 1`,
    [studentId, num]
  );

  const memorizedMap = new Map();
  memorizedRows.forEach(r => {
    memorizedMap.set(r.verse_number, {
      memorized_date: r.memorized_date,
      is_memorized: !!r.is_memorized
    });
  });

  const verses = [];
  for (let v = 1; v <= surah.total_verses; v++) {
    const mem = memorizedMap.get(v);
    verses.push({
      verse_number: v,
      juz_number: VERSE_TO_JUZ_MAP.get(`${num}:${v}`) || 1,
      is_memorized: !!mem,
      memorized_date: mem?.memorized_date || null
    });
  }

  const memorizedCount = memorizedRows.length;
  const isCompleted = memorizedCount === surah.total_verses;
  const percentage = surah.total_verses > 0 
    ? Math.round((memorizedCount / surah.total_verses) * 1000) / 10 
    : 0;

  return {
    surah,
    verses,
    memorized_count: memorizedCount,
    total_verses: surah.total_verses,
    percentage,
    is_completed: isCompleted
  };
}

/**
 * Save verse-level memorization for a student and Surah
 * Accepts an array of memorized verse numbers (e.g. [1, 2, 3, 5, 6])
 */
export async function saveStudentVerseMemorization(studentId, surahNumber, memorizedVerseNumbers, user) {
  const userId = typeof user === 'object' ? user.id : user;
  const userRole = typeof user === 'object' ? user.role : 'teacher';
  const sId = parseInt(studentId, 10);
  const sNum = parseInt(surahNumber, 10);
  const [surah] = await query(`SELECT * FROM quran_surahs WHERE number = ?`, [sNum]);
  if (!surah) {
    throw new Error('Suuradda la doortay ma jirto.');
  }

  const validVerses = new Set();
  (memorizedVerseNumbers || []).forEach(v => {
    const vn = parseInt(v, 10);
    if (vn >= 1 && vn <= surah.total_verses) {
      validVerses.add(vn);
    }
  });

  // Strict Finality: If user is a teacher, preserve all previously saved verses
  if (userRole === 'teacher') {
    const existingVerses = await query(
      `SELECT verse_number FROM quran_verse_memorization WHERE student_id = ? AND surah_number = ? AND is_memorized = 1`,
      [sId, sNum]
    );
    existingVerses.forEach(r => validVerses.add(r.verse_number));
  }

  await withTransaction(async (conn) => {
    // Teachers are strictly prevented from deleting any previously saved verses
    if (userRole !== 'teacher') {
      if (validVerses.size === 0) {
        await conn.execute(
          `DELETE FROM quran_verse_memorization WHERE student_id = ? AND surah_number = ?`,
          [sId, sNum]
        );
      } else {
        const placeholders = Array.from(validVerses).map(() => '?').join(',');
        await conn.execute(
          `DELETE FROM quran_verse_memorization 
           WHERE student_id = ? AND surah_number = ? AND verse_number NOT IN (${placeholders})`,
          [sId, sNum, ...Array.from(validVerses)]
        );
      }
    }

    // Insert or update newly memorized verses
    const currentDate = new Date().toISOString().split('T')[0];
    for (const vNum of validVerses) {
      await conn.execute(
        `INSERT INTO quran_verse_memorization (student_id, surah_number, verse_number, is_memorized, memorized_date, recorded_by)
         VALUES (?, ?, ?, 1, ?, ?)
         ON DUPLICATE KEY UPDATE is_memorized = 1, memorized_date = VALUES(memorized_date), recorded_by = VALUES(recorded_by)`,
        [sId, sNum, vNum, currentDate, userId]
      );
    }
  });

  return await getSurahVersesForStudent(sId, sNum);
}

/**
 * Calculate complete student memorization summary:
 * - Surah-by-surah progress
 * - All 30 Juz progress and exact completion
 * - Total memorized verses and overall %
 */
export async function calculateStudentMemorizationSummary(studentId, requestingUser = null) {
  const sId = parseInt(studentId, 10);

  // Fetch student info with Arabic name
  const [student] = await query(
    `SELECT s.id, s.student_id as student_code, s.full_name, s.name_ar, s.gender, s.phone,
            qe.group_id, qg.name as group_name, ql.name as level_name
     FROM students s
     LEFT JOIN quran_enrollments qe ON s.id = qe.student_id AND qe.status = 'active'
     LEFT JOIN quran_groups qg ON qe.group_id = qg.id
     LEFT JOIN quran_levels ql ON qg.level_id = ql.id
     WHERE s.id = ?`,
    [sId]
  );

  if (!student) {
    throw new Error('Ardayga lama helin.');
  }

  // Get assigned teacher(s) for the student's group
  let teachers = [];
  if (student.group_id) {
    teachers = await query(`
      SELECT u.id, u.full_name, u.phone
      FROM quran_teacher_assignments qta
      JOIN users u ON qta.teacher_id = u.id
      WHERE qta.group_id = ?
    `, [student.group_id]);
  }

  // Fetch all memorized verses for this student
  const memorizedRows = await query(
    `SELECT surah_number, verse_number, memorized_date
     FROM quran_verse_memorization
     WHERE student_id = ? AND is_memorized = 1`,
    [sId]
  );

  const memorizedSet = new Set(memorizedRows.map(r => `${r.surah_number}:${r.verse_number}`));
  const totalMemorizedVerses = memorizedSet.size;
  const TOTAL_QURAN_VERSES = 6236;
  const overallPercentage = Math.round((totalMemorizedVerses / TOTAL_QURAN_VERSES) * 1000) / 10;

  // Calculate Surah-by-Surah progress
  const surahs = await getAllSurahs();
  let completedSurahsCount = 0;
  let inProgressSurahsCount = 0;
  let notStartedSurahsCount = 0;

  const surahsProgress = surahs.map(s => {
    let memorizedInSurah = 0;
    for (let v = 1; v <= s.total_verses; v++) {
      if (memorizedSet.has(`${s.number}:${v}`)) {
        memorizedInSurah++;
      }
    }

    const isCompleted = memorizedInSurah === s.total_verses;
    const percentage = s.total_verses > 0 
      ? Math.round((memorizedInSurah / s.total_verses) * 1000) / 10 
      : 0;

    if (isCompleted) {
      completedSurahsCount++;
    } else if (memorizedInSurah > 0) {
      inProgressSurahsCount++;
    } else {
      notStartedSurahsCount++;
    }

    return {
      number: s.number,
      name_ar: s.name_ar,
      name_en: s.name_en,
      total_verses: s.total_verses,
      memorized_verses: memorizedInSurah,
      percentage,
      is_completed: isCompleted,
      revelation_type: s.revelation_type
    };
  });

  // Calculate exact Juz-by-Juz progress across all 30 Juz
  const juzList = await getAllJuz();
  let completedJuzCount = 0;
  let inProgressJuzCount = 0;
  const completedJuzNumbers = [];

  const juzProgress = juzList.map(j => {
    let memorizedInJuz = 0;

    // Check each Surah and verse in this Juz boundary
    for (let sNum = j.start_surah; sNum <= j.end_surah; sNum++) {
      const surahMeta = SURAHS_DATA[sNum - 1];
      const startV = (sNum === j.start_surah) ? j.start_verse : 1;
      const endV = (sNum === j.end_surah) ? j.end_verse : surahMeta.total_verses;

      for (let v = startV; v <= endV; v++) {
        if (memorizedSet.has(`${sNum}:${v}`)) {
          memorizedInJuz++;
        }
      }
    }

    const isCompleted = memorizedInJuz === j.total_verses;
    const percentage = j.total_verses > 0 
      ? Math.round((memorizedInJuz / j.total_verses) * 1000) / 10 
      : 0;

    if (isCompleted) {
      completedJuzCount++;
      completedJuzNumbers.push(j.juz_number);
    } else if (memorizedInJuz > 0) {
      inProgressJuzCount++;
    }

    return {
      juz_number: j.juz_number,
      name_ar: j.name_ar,
      start_surah: j.start_surah,
      start_verse: j.start_verse,
      end_surah: j.end_surah,
      end_verse: j.end_verse,
      total_verses: j.total_verses,
      memorized_verses: memorizedInJuz,
      percentage,
      is_completed: isCompleted
    };
  });

  // Fetch student Quran examinations
  const examinations = await query(`
    SELECT qe.*, u.full_name as created_by_name
    FROM quran_student_examinations qe
    LEFT JOIN users u ON qe.created_by = u.id
    WHERE qe.student_id = ?
    ORDER BY qe.exam_date DESC, qe.id DESC
  `, [sId]);

  // Fetch student attendance summary in Quran division
  const [attendanceSummary] = await query(`
    SELECT 
      COUNT(*) as total_sessions,
      SUM(CASE WHEN qa.status = 'present' THEN 1 ELSE 0 END) as present_count,
      SUM(CASE WHEN qa.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
      SUM(CASE WHEN qa.status = 'late' THEN 1 ELSE 0 END) as late_count,
      SUM(CASE WHEN qa.status = 'excused' THEN 1 ELSE 0 END) as excused_count
    FROM quran_attendance qa
    WHERE qa.student_id = ?
  `, [sId]);

  // Fetch Quran fee summary (strictly forbidden for teachers)
  let feeData = null;
  if (!requestingUser || requestingUser.role !== 'teacher') {
    const feeRows = await query(`
      SELECT 
        SUM(amount_due) as total_due,
        SUM(amount_paid) as total_paid,
        SUM(balance) as total_balance
      FROM fee_invoices
      WHERE student_id = ? AND division = 'quran'
    `, [sId]);
    feeData = feeRows[0] || { total_due: 0, total_paid: 0, total_balance: 0 };
  }

  return {
    student: {
      ...student,
      teachers
    },
    memorization: {
      total_verses: TOTAL_QURAN_VERSES,
      memorized_verses: totalMemorizedVerses,
      overall_percentage: overallPercentage,
      completed_surahs_count: completedSurahsCount,
      in_progress_surahs_count: inProgressSurahsCount,
      not_started_surahs_count: notStartedSurahsCount,
      completed_juz_count: completedJuzCount,
      in_progress_juz_count: inProgressJuzCount,
      completed_juz_list: completedJuzNumbers,
      memorized_verse_keys: Array.from(memorizedSet),
      surahs: surahsProgress,
      juz: juzProgress
    },
    examinations,
    attendance: attendanceSummary || { total_sessions: 0, present_count: 0, absent_count: 0, late_count: 0, excused_count: 0 },
    fee: feeData
  };
}

/**
 * Record a Quran examination for a student (Juz start to Juz end range)
 */
export async function recordStudentExamination(data, user) {
  const {
    student_id,
    group_id,
    exam_date,
    start_juz,
    end_juz,
    examiner_name,
    examiner_id,
    maximum_marks,
    marks_obtained,
    score,
    result,
    notes
  } = data;

  if (!student_id || !exam_date || !start_juz || !end_juz || !examiner_name) {
    throw new Error('Ardayga, taariikhda, heerka Juz (bilow & dhammaad), iyo magaca imtixaamayaha waa qasab.');
  }

  const sJuz = parseInt(start_juz, 10);
  const eJuz = parseInt(end_juz, 10);

  if (sJuz < 1 || sJuz > 30 || eJuz < 1 || eJuz > 30) {
    throw new Error('Juz-ku waa inuu u dhexeeyaa 1 ilaa 30.');
  }

  if (sJuz > eJuz) {
    throw new Error('Juz-ka bilowgu kama weynaan karo Juz-ka dhammaadka.');
  }

  const maxMarks = parseFloat(maximum_marks) || 100.00;
  const marksObt = marks_obtained !== undefined && marks_obtained !== '' && marks_obtained !== null 
    ? parseFloat(marks_obtained) 
    : null;

  if (marksObt !== null && (marksObt < 0 || marksObt > maxMarks)) {
    throw new Error(`Dhibcuhu waa inay u dhexeeyaan 0 ilaa ${maxMarks}.`);
  }

  const calculatedScore = marksObt !== null && maxMarks > 0 
    ? Math.round((marksObt / maxMarks) * 1000) / 10 
    : (score ? parseFloat(score) : null);

  const insertResult = await query(
    `INSERT INTO quran_student_examinations 
     (student_id, group_id, exam_date, start_juz, end_juz, examiner_name, examiner_id, maximum_marks, marks_obtained, score, result, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      student_id,
      group_id || null,
      exam_date,
      sJuz,
      eJuz,
      examiner_name.trim(),
      examiner_id || null,
      maxMarks,
      marksObt,
      calculatedScore,
      result || (calculatedScore >= 50 ? 'Gudbay (Pass)' : 'Haray (Fail)'),
      notes || null,
      user.id
    ]
  );

  await logAudit({
    userId: user.id,
    action: 'RECORD_QURAN_EXAM',
    module: 'quran_exams',
    division: 'quran',
    recordId: insertResult.insertId,
    details: `Recorded Quran exam for student #${student_id} (Juz ${sJuz} to ${eJuz}, Marks: ${marksObt}/${maxMarks})`
  });

  return { id: insertResult.insertId };
}

/**
 * Update a student's Quran examination record with audit
 */
export async function updateStudentExamination(id, data, user) {
  const [existing] = await query(`SELECT * FROM quran_student_examinations WHERE id = ?`, [id]);
  if (!existing) {
    throw new Error('Diiwaanka imtixaanka lama helin.');
  }

  const {
    exam_date,
    start_juz,
    end_juz,
    examiner_name,
    maximum_marks,
    marks_obtained,
    score,
    result,
    notes
  } = data;

  const sJuz = start_juz ? parseInt(start_juz, 10) : existing.start_juz;
  const eJuz = end_juz ? parseInt(end_juz, 10) : existing.end_juz;

  if (sJuz < 1 || sJuz > 30 || eJuz < 1 || eJuz > 30) {
    throw new Error('Juz-ku waa inuu u dhexeeyaa 1 ilaa 30.');
  }
  if (sJuz > eJuz) {
    throw new Error('Juz-ka bilowgu kama weynaan karo Juz-ka dhammaadka.');
  }

  const maxMarks = maximum_marks !== undefined ? parseFloat(maximum_marks) : existing.maximum_marks;
  const marksObt = marks_obtained !== undefined && marks_obtained !== '' && marks_obtained !== null 
    ? parseFloat(marks_obtained) 
    : existing.marks_obtained;

  const calculatedScore = marksObt !== null && maxMarks > 0 
    ? Math.round((marksObt / maxMarks) * 1000) / 10 
    : (score ? parseFloat(score) : existing.score);

  await query(
    `UPDATE quran_student_examinations SET
       exam_date = ?,
       start_juz = ?,
       end_juz = ?,
       examiner_name = ?,
       maximum_marks = ?,
       marks_obtained = ?,
       score = ?,
       result = ?,
       notes = ?,
       updated_by = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      exam_date || existing.exam_date,
      sJuz,
      eJuz,
      examiner_name ? examiner_name.trim() : existing.examiner_name,
      maxMarks,
      marksObt,
      calculatedScore,
      result || existing.result,
      notes !== undefined ? notes : existing.notes,
      user.id,
      id
    ]
  );

  await logAudit({
    userId: user.id,
    action: 'UPDATE_QURAN_EXAM',
    module: 'quran_exams',
    division: 'quran',
    recordId: id,
    details: `Updated Quran exam #${id} for student #${existing.student_id}`,
    beforeValue: existing
  });

  return { success: true };
}

/**
 * Get issued Quran certificates
 */
export async function getQuranCertificates(filters = {}) {
  const { student_id } = filters;
  let sql = `
    SELECT qc.*, s.student_id as student_code, s.full_name as student_name, s.name_ar as student_name_ar,
           u.full_name as issued_by_name
    FROM quran_certificates qc
    JOIN students s ON qc.student_id = s.id
    LEFT JOIN users u ON qc.issued_by = u.id
    WHERE 1=1
  `;
  const params = [];
  if (student_id) {
    sql += ` AND qc.student_id = ?`;
    params.push(student_id);
  }
  sql += ` ORDER BY qc.issue_date DESC, qc.id DESC`;

  return await query(sql, params);
}

/**
 * Issue a verified Quran certificate for a student
 * Validates that the student has completed the required Juz before certificate can be issued
 */
export async function issueQuranCertificate(data, user) {
  const { student_id, certificate_type, juz_completed, issue_date, remarks } = data;

  if (!student_id || !certificate_type || !juz_completed || !issue_date) {
    throw new Error('Ardayga, nooca shahaadada, tirada juz ee la dhameeyay, iyo taariikhda waa qasab.');
  }

  const sId = parseInt(student_id, 10);
  const countJuz = parseInt(juz_completed, 10);

  // Verify student exists
  const [student] = await query(`SELECT * FROM students WHERE id = ?`, [sId]);
  if (!student) {
    throw new Error('Ardayga lama helin.');
  }

  // Verify memorization
  const summary = await calculateStudentMemorizationSummary(sId);
  const verifiedJuzCompleted = summary.memorization.completed_juz_count;

  if (verifiedJuzCompleted < countJuz) {
    throw new Error(
      `Lama bixin karo shahaadada: Ardaygu wuxuu si xaqiiq ah u dhameystiray ${verifiedJuzCompleted} Juz oo keliya, laakiin waxaa la codsaday ${countJuz} Juz.`
    );
  }

  // Generate unique certificate number: QC-YYYY-XXXX
  const year = new Date(issue_date).getFullYear() || 2026;
  const rand = Math.floor(1000 + Math.random() * 9000);
  const certNumber = `QC-${year}-${sId.toString().padStart(4, '0')}-${rand}`;

  const result = await query(
    `INSERT INTO quran_certificates (certificate_number, student_id, certificate_type, juz_completed, issue_date, issued_by, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [certNumber, sId, certificate_type, countJuz, issue_date, user.id, remarks || null]
  );

  await logAudit({
    userId: user.id,
    action: 'ISSUE_QURAN_CERTIFICATE',
    module: 'quran_certificates',
    division: 'quran',
    recordId: result.insertId,
    details: `Issued Quran certificate ${certNumber} (${countJuz} Juz) to student #${sId}`
  });

  return {
    id: result.insertId,
    certificate_number: certNumber,
    verified_juz: verifiedJuzCompleted
  };
}

/**
 * Get all 114 Surahs with completion status for a specific student
 */
export async function getStudentSurahs(studentId) {
  const sId = parseInt(studentId, 10);
  const surahs = await getAllSurahs();

  // Get count of memorized verses per surah for this student
  const rows = await query(`
    SELECT surah_number, COUNT(*) as memorized_verses, MAX(memorized_date) as memorized_date
    FROM quran_verse_memorization
    WHERE student_id = ? AND is_memorized = 1
    GROUP BY surah_number
  `, [sId]);

  const map = new Map();
  rows.forEach(r => {
    map.set(r.surah_number, {
      memorized_verses: r.memorized_verses,
      memorized_date: r.memorized_date
    });
  });

  let completedCount = 0;
  const list = surahs.map(s => {
    const mem = map.get(s.number);
    const memVerses = mem ? mem.memorized_verses : 0;
    const isCompleted = memVerses === s.total_verses;
    if (isCompleted) completedCount++;

    return {
      number: s.number,
      name_ar: s.name_ar,
      name_en: s.name_en,
      total_verses: s.total_verses,
      revelation_type: s.revelation_type,
      memorized_verses: memVerses,
      is_memorized: isCompleted,
      memorized_date: mem?.memorized_date || null
    };
  });

  return {
    surahs: list,
    completed_count: completedCount,
    total_surahs: 114
  };
}

/**
 * Bulk save completed Surahs for a student
 * Accepts array of fully completed surah numbers e.g. [1, 2, 112, 113, 114]
 * Enforces strict finality for teachers: teachers cannot delete, undo, or unmark previously saved surahs.
 */
export async function saveStudentSurahs(studentId, surahNumbers, user) {
  const userId = typeof user === 'object' ? user.id : user;
  const userRole = typeof user === 'object' ? user.role : 'teacher';
  const sId = parseInt(studentId, 10);
  const surahs = await getAllSurahs();
  const currentDate = new Date().toISOString().split('T')[0];

  // 1. Fetch currently completed Surahs for this student before updates
  const existingCompletedRows = await query(`
    SELECT qs.number, qs.total_verses, COUNT(qvm.verse_number) as memorized_count
    FROM quran_surahs qs
    JOIN quran_verse_memorization qvm ON qs.number = qvm.surah_number
    WHERE qvm.student_id = ? AND qvm.is_memorized = 1
    GROUP BY qs.number, qs.total_verses
    HAVING memorized_count = qs.total_verses
  `, [sId]);
  const previouslyCompletedSet = new Set(existingCompletedRows.map(r => r.number));

  let finalSelectedSet = new Set((surahNumbers || []).map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 114));

  // 2. ENFORCE FINALITY FOR TEACHERS:
  // Once saved, completion decisions are final for teachers.
  // Teachers cannot unmark, undo, or delete previously completed Surahs.
  if (userRole === 'teacher') {
    // Re-add any previously completed surah that the teacher might have unchecked/omitted
    for (const prevNum of previouslyCompletedSet) {
      finalSelectedSet.add(prevNum);
    }
  }

  // 3. For Admins: Track if any previously completed surahs are being reversed
  const removedSurahs = [];
  if (userRole === 'super_admin' || userRole === 'quran_admin') {
    for (const prevNum of previouslyCompletedSet) {
      if (!finalSelectedSet.has(prevNum)) {
        removedSurahs.push(prevNum);
      }
    }
  }

  await withTransaction(async (conn) => {
    // Deletion is strictly forbidden for teachers! Only Admins may reverse or delete
    if (userRole !== 'teacher') {
      if (finalSelectedSet.size === 0) {
        await conn.execute(
          `DELETE FROM quran_verse_memorization WHERE student_id = ?`,
          [sId]
        );
      } else {
        const placeholders = Array.from(finalSelectedSet).map(() => '?').join(',');
        await conn.execute(
          `DELETE FROM quran_verse_memorization 
           WHERE student_id = ? AND surah_number NOT IN (${placeholders})`,
          [sId, ...Array.from(finalSelectedSet)]
        );
      }
    }

    // Insert any newly added completed Surahs
    for (const sNum of finalSelectedSet) {
      const surahMeta = surahs.find(s => s.number === sNum);
      if (!surahMeta) continue;

      // Find which verses are already recorded as memorized
      const [existingVerses] = await conn.execute(
        `SELECT verse_number FROM quran_verse_memorization WHERE student_id = ? AND surah_number = ? AND is_memorized = 1`,
        [sId, sNum]
      );
      const existingSet = new Set(existingVerses.map(r => r.verse_number));

      // Insert any missing verses for this completed surah
      const missingVerses = [];
      for (let v = 1; v <= surahMeta.total_verses; v++) {
        if (!existingSet.has(v)) {
          missingVerses.push(v);
        }
      }

      if (missingVerses.length > 0) {
        const values = [];
        const placeholders = missingVerses.map(v => {
          values.push(sId, sNum, v, 1, currentDate, userId);
          return '(?, ?, ?, ?, ?, ?)';
        }).join(',');

        await conn.execute(
          `INSERT INTO quran_verse_memorization (student_id, surah_number, verse_number, is_memorized, memorized_date, recorded_by)
           VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE is_memorized = 1, memorized_date = VALUES(memorized_date), recorded_by = VALUES(recorded_by)`,
          values
        );
      }
    }
  });

  // Maintain audit trail if an Admin reversed any previously saved completion
  if (removedSurahs.length > 0) {
    const adminIdentifier = typeof user === 'object' ? (user.username || user.full_name || userId) : userId;
    await logAudit({
      userId,
      action: 'ADMIN_REVERSE_SURAH_MEMORIZATION',
      module: 'quran',
      division: 'quran',
      recordId: sId,
      details: `Admin ${adminIdentifier} reversed completion of Surah(s): [${removedSurahs.join(', ')}] for student #${sId}`,
      beforeValue: { reversed_surah_numbers: removedSurahs },
      afterValue: { current_completed_count: finalSelectedSet.size }
    });
  }

  const updatedSummary = await calculateStudentMemorizationSummary(sId, user);
  return {
    student_summary: updatedSummary,
    completed_surahs_count: finalSelectedSet.size,
    previously_completed_count: previouslyCompletedSet.size,
    newly_added_count: Array.from(finalSelectedSet).filter(n => !previouslyCompletedSet.has(n)).length
  };
}
