import { query } from '../backend/src/db/connection.js';

async function migrate() {
  console.log('--- Migrating Quran Memorization Exams Schema ---');

  // 1. Create quran_exam_error_types table
  await query(`
    CREATE TABLE IF NOT EXISTS quran_exam_error_types (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      name_ar VARCHAR(100) NULL,
      description TEXT NULL,
      severity ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
      deduction_points DECIMAL(5,2) NOT NULL DEFAULT 1.00,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_err_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ Created or verified quran_exam_error_types');

  // Seed default error types if table is empty
  const [existingErrors] = await query('SELECT COUNT(*) as c FROM quran_exam_error_types');
  if (existingErrors.c === 0) {
    await query(`
      INSERT INTO quran_exam_error_types (name, name_ar, description, severity, deduction_points, is_active)
      VALUES 
      ('Rujuuc', 'رجوع', 'Ku noqoshada aayad ama erey hore loo akhriyay (Returning to a previously recited passage)', 'low', 0.50, 1),
      ('Gaf', 'خطأ في الحفظ', 'Gaf xifdiga ah ama ilowsho aayadeed (A memorization or recitation mistake)', 'high', 2.00, 1),
      ('Xaraf khaldan', 'خطأ في الحرف / التجويد', 'Xaraf la baddalay ama khalad xagga tajwiidka ah (An incorrect letter or tajweed error)', 'medium', 1.00, 1),
      ('Taraddud / Joogsi', 'تردد / توقف', 'Hakasho dheer ama laba-labeyn xilliga akhriska (Hesitation or prolonged pausing)', 'low', 0.50, 1)
    `);
    console.log('✓ Seeded initial configurable error types');
  }

  // 2. Add total_deductions and final_score to quran_student_examinations if missing
  const cols = await query('DESCRIBE quran_student_examinations');
  const colNames = cols.map(c => c.Field);

  if (!colNames.includes('total_deductions')) {
    await query('ALTER TABLE quran_student_examinations ADD COLUMN total_deductions DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER maximum_marks');
    console.log('✓ Added total_deductions to quran_student_examinations');
  }
  if (!colNames.includes('final_score')) {
    await query('ALTER TABLE quran_student_examinations ADD COLUMN final_score DECIMAL(5,2) NULL AFTER marks_obtained');
    console.log('✓ Added final_score to quran_student_examinations');
  }

  // 3. Create quran_student_exam_errors table
  await query(`
    CREATE TABLE IF NOT EXISTS quran_student_exam_errors (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      exam_id INT NOT NULL,
      error_type_id INT NULL,
      error_name VARCHAR(100) NOT NULL,
      error_name_ar VARCHAR(100) NULL,
      severity VARCHAR(20) NOT NULL,
      deduction_per_unit DECIMAL(5,2) NOT NULL,
      occurrences INT NOT NULL DEFAULT 1,
      total_deduction DECIMAL(5,2) NOT NULL,
      notes VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (exam_id) REFERENCES quran_student_examinations(id) ON DELETE CASCADE,
      FOREIGN KEY (error_type_id) REFERENCES quran_exam_error_types(id) ON DELETE SET NULL,
      INDEX idx_qexam_err_exam (exam_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ Created or verified quran_student_exam_errors');

  console.log('--- Migration Completed Successfully ---');
  process.exit(0);
}

migrate().catch(e => {
  console.error('Migration error:', e);
  process.exit(1);
});
