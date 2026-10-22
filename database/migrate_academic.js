import { query } from '../backend/src/db/connection.js';

async function migrate() {
  console.log('--- RUNNING ACADEMIC MODULE DATABASE MIGRATION ---');

  // 1. Create institute_class_subjects table
  await query(`
    CREATE TABLE IF NOT EXISTS institute_class_subjects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      class_id INT NOT NULL,
      subject_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES institute_classes(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES institute_subjects(id) ON DELETE RESTRICT,
      UNIQUE KEY uk_class_subject (class_id, subject_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ 1. institute_class_subjects table ready');

  // 2. Add description to institute_classes
  try {
    await query(`ALTER TABLE institute_classes ADD COLUMN description TEXT NULL AFTER academic_year`);
    console.log('✓ 2. Added description to institute_classes');
  } catch (e) {
    console.log('✓ 2. description already exists in institute_classes');
  }

  // 3. Add updated_at to institute_classes
  try {
    await query(`ALTER TABLE institute_classes ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`);
    console.log('✓ 3. Added updated_at to institute_classes');
  } catch (e) {
    console.log('✓ 3. updated_at already exists in institute_classes');
  }

  // 4. Add updated_at to institute_subjects
  try {
    await query(`ALTER TABLE institute_subjects ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`);
    console.log('✓ 4. Added updated_at to institute_subjects');
  } catch (e) {
    console.log('✓ 4. updated_at already exists in institute_subjects');
  }

  // 5. Alter institute_timetable day_of_week to VARCHAR(20)
  await query(`ALTER TABLE institute_timetable MODIFY COLUMN day_of_week VARCHAR(20) NOT NULL`);
  console.log('✓ 5. Altered institute_timetable day_of_week to VARCHAR(20)');

  // 6. Add notes and updated_at to institute_timetable
  try {
    await query(`ALTER TABLE institute_timetable ADD COLUMN notes TEXT NULL AFTER room`);
    console.log('✓ 6. Added notes to institute_timetable');
  } catch (e) {
    console.log('✓ 6. notes already exists in institute_timetable');
  }

  try {
    await query(`ALTER TABLE institute_timetable ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`);
    console.log('✓ 7. Added updated_at to institute_timetable');
  } catch (e) {
    console.log('✓ 7. updated_at already exists in institute_timetable');
  }

  // 7. Seed initial class_subjects if empty
  const [countRes] = await query(`SELECT COUNT(*) as cnt FROM institute_class_subjects`);
  if (countRes.cnt === 0) {
    await query(`
      INSERT IGNORE INTO institute_class_subjects (class_id, subject_id) VALUES 
      (1, 1), (1, 2), (1, 3), 
      (2, 1), (2, 3), 
      (3, 4), (3, 5)
    `);
    console.log('✓ 8. Seeded initial class_subjects');
  }

  console.log('--- ACADEMIC MIGRATION COMPLETED SUCCESSFULLY ---');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
