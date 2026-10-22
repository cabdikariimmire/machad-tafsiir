import { ensureOfficialExamPeriods } from '../src/services/examStructureService.js';
import { query } from '../src/db/connection.js';

async function run() {
  console.log('Seeding / migrating official Two-Half examination periods for 2026 and 2027...');
  await ensureOfficialExamPeriods('2026');
  await ensureOfficialExamPeriods('2027');

  const rows = await query(`
    SELECT id, name, academic_year, exam_type, sequence_order, max_contribution, status 
    FROM exam_periods 
    WHERE academic_year IN ('2026', '2027') AND name IN ('النصف الأول', 'النهائي الأول', 'النصف الثاني', 'النهائي الثاني')
    ORDER BY academic_year ASC, sequence_order ASC
  `);
  console.log('Official Exam Periods in DB:');
  console.table(rows);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
