import { query } from '../backend/src/db/connection.js';

export async function runExamEnhancementsMigration() {
  console.log('--- Migrating Exam Management, Timetables, Promotions & Assessment Config ---');

  // 1. Add class progression columns to institute_classes
  const classCols = await query(`DESCRIBE institute_classes`);
  const classFieldNames = classCols.map(c => c.Field);

  if (!classFieldNames.includes('progression_order')) {
    await query(`ALTER TABLE institute_classes ADD COLUMN progression_order INT NOT NULL DEFAULT 1 AFTER description`);
    console.log('✓ Added progression_order to institute_classes');
  }
  if (!classFieldNames.includes('is_entry_class')) {
    await query(`ALTER TABLE institute_classes ADD COLUMN is_entry_class BOOLEAN NOT NULL DEFAULT FALSE AFTER progression_order`);
    console.log('✓ Added is_entry_class to institute_classes');
  }
  if (!classFieldNames.includes('is_final_class')) {
    await query(`ALTER TABLE institute_classes ADD COLUMN is_final_class BOOLEAN NOT NULL DEFAULT FALSE AFTER is_entry_class`);
    console.log('✓ Added is_final_class to institute_classes');
  }

  // Set default progression orders if all 1
  const existingClasses = await query(`SELECT id, name, progression_order FROM institute_classes ORDER BY id ASC`);
  let order = 1;
  for (const cls of existingClasses) {
    const isFirst = order === 1;
    const isLast = order === existingClasses.length;
    await query(`
      UPDATE institute_classes 
      SET progression_order = ?, is_entry_class = ?, is_final_class = ?
      WHERE id = ? AND (progression_order = 1 OR progression_order IS NULL)
    `, [order, isFirst, isLast, cls.id]);
    order++;
  }
  console.log('✓ Configured default class progression order');

  // 2. Add columns to exam_periods for annual examination plan
  const periodCols = await query(`DESCRIBE exam_periods`);
  const periodFieldNames = periodCols.map(c => c.Field);

  if (!periodFieldNames.includes('exam_type')) {
    await query(`ALTER TABLE exam_periods ADD COLUMN exam_type VARCHAR(50) NOT NULL DEFAULT 'monthly' AFTER academic_year`);
    console.log('✓ Added exam_type to exam_periods');
  }
  if (!periodFieldNames.includes('sequence_order')) {
    await query(`ALTER TABLE exam_periods ADD COLUMN sequence_order INT NOT NULL DEFAULT 1 AFTER exam_type`);
    console.log('✓ Added sequence_order to exam_periods');
  }
  if (!periodFieldNames.includes('max_contribution')) {
    await query(`ALTER TABLE exam_periods ADD COLUMN max_contribution DECIMAL(5,2) NOT NULL DEFAULT 100.00 AFTER sequence_order`);
    console.log('✓ Added max_contribution to exam_periods');
  }
  if (!periodFieldNames.includes('description')) {
    await query(`ALTER TABLE exam_periods ADD COLUMN description TEXT NULL AFTER status`);
    console.log('✓ Added description to exam_periods');
  }

  // Update existing periods sequence
  const currentPeriods = await query(`SELECT id, name FROM exam_periods ORDER BY id ASC`);
  let pSeq = 1;
  for (const p of currentPeriods) {
    let pType = 'monthly';
    let pContribution = 100.00;
    if (p.name.toLowerCase().includes('midterm') || p.name.toLowerCase().includes('term')) {
      pType = 'term';
    } else if (p.name.toLowerCase().includes('final')) {
      pType = 'final';
    }
    await query(`
      UPDATE exam_periods 
      SET sequence_order = ?, exam_type = ?, max_contribution = ?
      WHERE id = ? AND (sequence_order = 1 OR sequence_order IS NULL)
    `, [pSeq, pType, pContribution, p.id]);
    pSeq++;
  }

  // 3. Create academic_year_assessment_configs table
  await query(`
    CREATE TABLE IF NOT EXISTS academic_year_assessment_configs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      academic_year VARCHAR(30) NOT NULL UNIQUE,
      marking_mode ENUM('mode_a', 'mode_b') NOT NULL DEFAULT 'mode_b',
      mode_b_calculation ENUM('average', 'final_only') NOT NULL DEFAULT 'average',
      pass_threshold DECIMAL(5,2) NOT NULL DEFAULT 50.00,
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✓ Created academic_year_assessment_configs table');

  // Seed default 2026 assessment config
  await query(`
    INSERT IGNORE INTO academic_year_assessment_configs (academic_year, marking_mode, mode_b_calculation, pass_threshold)
    VALUES ('2026', 'mode_b', 'average', 50.00)
  `);

  // 4. Create exam_timetables table
  await query(`
    CREATE TABLE IF NOT EXISTS exam_timetables (
      id INT AUTO_INCREMENT PRIMARY KEY,
      academic_year VARCHAR(30) NOT NULL DEFAULT '2026',
      exam_period_id INT NOT NULL,
      class_id INT NOT NULL,
      subject_id INT NOT NULL,
      exam_date DATE NOT NULL,
      day_of_week VARCHAR(20) NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      notes VARCHAR(255) NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (exam_period_id) REFERENCES exam_periods(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES institute_classes(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES institute_subjects(id) ON DELETE RESTRICT,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
      UNIQUE KEY uk_exam_timetable_slot (class_id, exam_period_id, subject_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✓ Created exam_timetables table');

  // 5. Create student_promotion_history table
  await query(`
    CREATE TABLE IF NOT EXISTS student_promotion_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      from_academic_year VARCHAR(30) NOT NULL,
      to_academic_year VARCHAR(30) NOT NULL,
      from_class_id INT NOT NULL,
      to_class_id INT NULL,
      outcome ENUM('promoted', 'retained', 'graduated', 'manual_override') NOT NULL,
      overall_total DECIMAL(7,2) NULL,
      overall_percentage DECIMAL(5,2) NULL,
      is_override BOOLEAN NOT NULL DEFAULT FALSE,
      override_reason TEXT NULL,
      processed_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
      FOREIGN KEY (from_class_id) REFERENCES institute_classes(id) ON DELETE RESTRICT,
      FOREIGN KEY (to_class_id) REFERENCES institute_classes(id) ON DELETE SET NULL,
      FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE RESTRICT,
      UNIQUE KEY uk_student_promotion_year (student_id, from_academic_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✓ Created student_promotion_history table');

  console.log('Migration completed successfully!');
}

if (process.argv[1]?.endsWith('migrate_exam_enhancements.js')) {
  runExamEnhancementsMigration()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
