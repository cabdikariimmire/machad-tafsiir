import { query } from '../backend/src/db/connection.js';

async function migrate() {
  console.log('--- STARTING EXAMS MODULE MIGRATION ---');

  // 1. Add academic_year to institute_exams
  try {
    await query(`ALTER TABLE institute_exams ADD COLUMN academic_year VARCHAR(30) NOT NULL DEFAULT '2026' AFTER title`);
    console.log('✓ 1. Added academic_year to institute_exams');
  } catch (e) {
    console.log('✓ 1. academic_year already exists in institute_exams');
  }

  // 2. Add updated_at to institute_exams
  try {
    await query(`ALTER TABLE institute_exams ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`);
    console.log('✓ 2. Added updated_at to institute_exams');
  } catch (e) {
    console.log('✓ 2. updated_at already exists in institute_exams');
  }

  // 3. Update status to include 'finalized'
  try {
    await query(`ALTER TABLE institute_exams MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'draft'`);
    console.log('✓ 3. Updated status in institute_exams');
  } catch (e) {
    console.log('✓ 3. Error updating status in institute_exams:', e.message);
  }

  // 4. Add academic_year & updated_at & status update to quran_exams
  try {
    await query(`ALTER TABLE quran_exams ADD COLUMN academic_year VARCHAR(30) NOT NULL DEFAULT '2026' AFTER title`);
    console.log('✓ 4. Added academic_year to quran_exams');
  } catch (e) {
    console.log('✓ 4. academic_year already exists in quran_exams');
  }

  try {
    await query(`ALTER TABLE quran_exams ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`);
    console.log('✓ 5. Added updated_at to quran_exams');
  } catch (e) {
    console.log('✓ 5. updated_at already exists in quran_exams');
  }

  try {
    await query(`ALTER TABLE quran_exams MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'draft'`);
    console.log('✓ 6. Updated status in quran_exams');
  } catch (e) {
    console.log('✓ 6. Error updating status in quran_exams:', e.message);
  }

  // 5. Add unique constraint for institute_exams to prevent duplicates
  try {
    await query(`ALTER TABLE institute_exams ADD UNIQUE KEY uk_inst_exam_dup (class_id, subject_id, title, academic_year)`);
    console.log('✓ 7. Added uk_inst_exam_dup unique key on institute_exams');
  } catch (e) {
    console.log('✓ 7. uk_inst_exam_dup already exists or error:', e.message);
  }

  console.log('--- EXAMS MODULE MIGRATION COMPLETED SUCCESSFULLY ---');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
