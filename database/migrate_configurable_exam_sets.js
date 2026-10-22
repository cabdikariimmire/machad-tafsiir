import { query } from '../backend/src/db/connection.js';

export async function runConfigurableExamSetsMigration() {
  console.log('--- Migrating configurable connected examination sets ---');

  const examColumns = await query(`DESCRIBE institute_exams`);
  if (!examColumns.some(column => column.Field === 'exam_set_id')) {
    await query(`ALTER TABLE institute_exams ADD COLUMN exam_set_id INT NULL AFTER academic_year`);
    console.log('✓ Added exam_set_id to institute_exams');
  }

  await query(`
    CREATE TABLE IF NOT EXISTS institute_exam_sets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      academic_year VARCHAR(30) NOT NULL,
      description TEXT NULL,
      status ENUM('configured', 'confirmed', 'closed') NOT NULL DEFAULT 'configured',
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
      UNIQUE KEY uk_exam_set_year (academic_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS institute_exam_set_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      exam_set_id INT NOT NULL,
      exam_period_id INT NOT NULL,
      sequence_order INT NOT NULL DEFAULT 1,
      maximum_marks DECIMAL(7,2) NOT NULL,
      is_required BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (exam_set_id) REFERENCES institute_exam_sets(id) ON DELETE CASCADE,
      FOREIGN KEY (exam_period_id) REFERENCES exam_periods(id) ON DELETE RESTRICT,
      UNIQUE KEY uk_exam_set_member (exam_set_id, exam_period_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const fk = await query(`
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'institute_exams'
      AND COLUMN_NAME = 'exam_set_id' AND REFERENCED_TABLE_NAME = 'institute_exam_sets'
  `);
  if (fk.length === 0) {
    await query(`
      ALTER TABLE institute_exams
      ADD CONSTRAINT fk_institute_exam_set FOREIGN KEY (exam_set_id)
      REFERENCES institute_exam_sets(id) ON DELETE SET NULL
    `);
    console.log('✓ Added exam-set referential integrity');
  }

  console.log('Configurable examination migration completed successfully.');
}

if (process.argv[1]?.endsWith('migrate_configurable_exam_sets.js')) {
  runConfigurableExamSetsMigration()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Configurable examination migration failed:', error);
      process.exit(1);
    });
}
