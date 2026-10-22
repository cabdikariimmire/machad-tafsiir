import { query } from '../backend/src/db/connection.js';

async function migrate() {
  console.log('--- Migrating Unified Exam Periods and Exam Fee Management ---');

  // 1. Create exam_periods table
  await query(`
    CREATE TABLE IF NOT EXISTS exam_periods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      academic_year VARCHAR(30) NOT NULL DEFAULT '2026',
      start_date DATE NULL,
      end_date DATE NULL,
      status ENUM('active', 'closed') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_exam_period_name_year (name, academic_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✓ Created or verified exam_periods table');

  // Seed standard default exam periods for 2026
  const defaultPeriods = [
    'Monthly Exam 1',
    'Midterm Exam',
    'Monthly Exam 2',
    'Final Exam'
  ];

  for (const period of defaultPeriods) {
    await query(`
      INSERT IGNORE INTO exam_periods (name, academic_year, status)
      VALUES (?, '2026', 'active')
    `, [period]);
  }

  // Also import any existing exam titles from institute_exams
  const existingTitles = await query(`
    SELECT DISTINCT title, academic_year FROM institute_exams WHERE title IS NOT NULL AND TRIM(title) != ''
  `);
  for (const t of existingTitles) {
    await query(`
      INSERT IGNORE INTO exam_periods (name, academic_year, status)
      VALUES (?, ?, 'active')
    `, [t.title.trim(), t.academic_year || '2026']);
  }
  console.log('✓ Seeded default & existing exam periods');

  // 2. Create exam_fee_rules table
  await query(`
    CREATE TABLE IF NOT EXISTS exam_fee_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      academic_year VARCHAR(30) NOT NULL DEFAULT '2026',
      exam_period VARCHAR(100) NOT NULL,
      class_id INT NULL,
      amount DECIMAL(10,2) NOT NULL DEFAULT 10.00,
      description VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_exam_fee_rule (academic_year, exam_period, class_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✓ Created or verified exam_fee_rules table');

  // Seed default official fee rules ($10 per exam period)
  for (const period of defaultPeriods) {
    await query(`
      INSERT IGNORE INTO exam_fee_rules (academic_year, exam_period, class_id, amount, description)
      VALUES ('2026', ?, NULL, 10.00, 'Lacagta Rasmiga ah ee Imtixaanka')
    `, [period]);
  }
  console.log('✓ Seeded default exam fee rules');

  // 3. Create exam_fee_payments table
  await query(`
    CREATE TABLE IF NOT EXISTS exam_fee_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      receipt_number VARCHAR(50) NOT NULL UNIQUE,
      academic_year VARCHAR(30) NOT NULL DEFAULT '2026',
      exam_period VARCHAR(100) NOT NULL,
      student_id INT NOT NULL,
      class_id INT NULL,
      fee_amount DECIMAL(10,2) NOT NULL,
      amount_paid DECIMAL(10,2) NOT NULL,
      balance_remaining DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      payment_date DATE NOT NULL,
      status ENUM('valid', 'voided') NOT NULL DEFAULT 'valid',
      received_by INT NOT NULL,
      notes VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_efp_student (student_id),
      INDEX idx_efp_period (exam_period, academic_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✓ Created or verified exam_fee_payments table');

  console.log('Migration completed successfully!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
