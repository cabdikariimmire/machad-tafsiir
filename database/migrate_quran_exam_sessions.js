import mysql from 'mysql2/promise';

async function migrate() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mahad_db'
  });

  console.log('Running Quran Exam Sessions migration...');

  try {
    // 1. Allow group_id to be NULL in quran_exams
    await conn.query(`ALTER TABLE quran_exams MODIFY group_id INT NULL`);
    console.log('✓ Modified group_id to allow NULL in quran_exams');
  } catch (e) {
    console.log('Note on group_id in quran_exams:', e.message);
  }

  try {
    // 2. Check if exam_id column exists in quran_student_examinations
    const [cols] = await conn.query(`SHOW COLUMNS FROM quran_student_examinations LIKE 'exam_id'`);
    if (cols.length === 0) {
      await conn.query(`ALTER TABLE quran_student_examinations ADD COLUMN exam_id INT NULL AFTER id`);
      console.log('✓ Added exam_id column to quran_student_examinations');
      try {
        await conn.query(`
          ALTER TABLE quran_student_examinations
          ADD CONSTRAINT fk_qse_exam_id
          FOREIGN KEY (exam_id) REFERENCES quran_exams(id) ON DELETE CASCADE
        `);
        console.log('✓ Added foreign key fk_qse_exam_id');
      } catch (fkErr) {
        console.log('Note on adding fk_qse_exam_id:', fkErr.message);
      }
    } else {
      console.log('✓ exam_id already exists in quran_student_examinations');
    }
  } catch (e) {
    console.log('Error checking/adding exam_id:', e.message);
  }

  // 3. Link any orphaned legacy student examinations to an exam session
  try {
    const [orphaned] = await conn.query(`
      SELECT DISTINCT exam_date, group_id, created_by 
      FROM quran_student_examinations 
      WHERE exam_id IS NULL
    `);

    for (const row of orphaned) {
      const dateStr = row.exam_date instanceof Date ? row.exam_date.toISOString().split('T')[0] : String(row.exam_date).substring(0, 10);
      const title = `Imtixaanka Xifdiga (${dateStr})`;
      const [insertRes] = await conn.query(`
        INSERT INTO quran_exams (title, group_id, exam_date, maximum_marks, status, created_by)
        VALUES (?, ?, ?, 100.00, 'published', ?)
      `, [title, row.group_id || null, dateStr, row.created_by || 1]);

      const newExamId = insertRes.insertId;
      await conn.query(`
        UPDATE quran_student_examinations
        SET exam_id = ?
        WHERE exam_date = ? AND (group_id = ? OR (group_id IS NULL AND ? IS NULL)) AND exam_id IS NULL
      `, [newExamId, dateStr, row.group_id, row.group_id]);
      console.log(`✓ Linked legacy examinations on ${dateStr} to exam session #${newExamId} ("${title}")`);
    }
  } catch (e) {
    console.log('Note linking legacy exams:', e.message);
  }

  console.log('Migration finished successfully!');
  await conn.end();
}

migrate().catch(console.error);
