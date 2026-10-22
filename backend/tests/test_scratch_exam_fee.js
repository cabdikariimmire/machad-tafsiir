import { query } from '../src/db/connection.js';

async function testUnifiedLogic() {
  console.log('Testing Unified Exam & Fee queries...');

  // 1. Check classes and subjects
  const classes = await query('SELECT id, name FROM institute_classes WHERE is_active = 1 LIMIT 3');
  console.log('Active classes:', classes);

  if (classes.length > 0) {
    const classId = classes[0].id;
    // Students
    const students = await query(`
      SELECT s.id as student_id, s.student_id as student_code, s.full_name, s.gender
      FROM institute_enrollments ie
      JOIN students s ON ie.student_id = s.id
      WHERE ie.class_id = ? AND ie.status = 'active' AND s.is_active = 1
      ORDER BY s.full_name ASC
    `, [classId]);
    console.log(`Class ${classId} active students:`, students.length);

    // Subjects
    const subjects = await query(`
      SELECT s.id as subject_id, s.name as subject_name, s.code as subject_code
      FROM institute_class_subjects cs
      JOIN institute_subjects s ON cs.subject_id = s.id
      WHERE cs.class_id = ? AND s.is_active = 1
      ORDER BY s.name ASC
    `, [classId]);
    console.log(`Class ${classId} assigned subjects:`, subjects);
  }

  // 2. Check exam fee sequence query
  const [seqRow] = await query(`
    SELECT COUNT(*) as cnt FROM exam_fee_payments WHERE academic_year = '2026'
  `);
  const nextNum = Number(seqRow.cnt || 0) + 1;
  const receiptNumber = `EX-2026-${String(nextNum).padStart(4, '0')}`;
  console.log('Sample receipt number:', receiptNumber);

  console.log('Queries tested successfully!');
  process.exit(0);
}

testUnifiedLogic().catch(err => {
  console.error(err);
  process.exit(1);
});
