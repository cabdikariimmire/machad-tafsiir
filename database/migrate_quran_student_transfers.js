import { query } from '../backend/src/db/connection.js';

/**
 * Safe Quran student-transfer migration.
 * It only creates the audit/history table and does not rewrite enrollments or
 * any student, memorization, attendance, examination, or financial records.
 */
async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS quran_student_transfer_history (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      from_group_id INT NOT NULL,
      to_group_id INT NOT NULL,
      transfer_date DATE NOT NULL,
      reason TEXT NULL,
      transferred_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
      FOREIGN KEY (from_group_id) REFERENCES quran_groups(id) ON DELETE RESTRICT,
      FOREIGN KEY (to_group_id) REFERENCES quran_groups(id) ON DELETE RESTRICT,
      FOREIGN KEY (transferred_by) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX idx_quran_transfer_student_date (student_id, transfer_date),
      INDEX idx_quran_transfer_from_group (from_group_id),
      INDEX idx_quran_transfer_to_group (to_group_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('Quran student-transfer history migration completed without changing existing records.');
}

migrate().then(() => process.exit(0)).catch((error) => {
  console.error('Quran student-transfer migration failed:', error);
  process.exit(1);
});
