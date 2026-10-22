import { query } from '../backend/src/db/connection.js';

/**
 * Adds the durable safeguards used by the automatic promotion workflow.
 * This migration is additive: legacy progression columns and history remain
 * intact so historical reports continue to work.
 */
export async function runAutomaticPromotionsMigration() {
  console.log('--- Migrating automatic promotion workflow ---');

  const classCols = await query(`DESCRIBE institute_classes`);
  const classFields = new Set(classCols.map(column => column.Field));

  if (!classFields.has('next_class_id')) {
    await query(`ALTER TABLE institute_classes ADD COLUMN next_class_id INT NULL AFTER is_active`);
    console.log('✓ Added explicit next_class_id to institute_classes');
  }
  if (!classFields.has('graduation_pass_threshold')) {
    await query(`ALTER TABLE institute_classes ADD COLUMN graduation_pass_threshold DECIMAL(5,2) NULL AFTER next_class_id`);
    console.log('✓ Added graduation_pass_threshold to institute_classes');
  }

  const nextClassConstraints = await query(`
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'institute_classes'
      AND COLUMN_NAME = 'next_class_id'
      AND REFERENCED_TABLE_NAME = 'institute_classes'
  `);
  if (nextClassConstraints.length === 0) {
    await query(`
      ALTER TABLE institute_classes
      ADD CONSTRAINT fk_class_next_class FOREIGN KEY (next_class_id)
      REFERENCES institute_classes(id) ON DELETE SET NULL
    `);
    console.log('✓ Added next-class referential integrity');
  }

  const enrollmentCols = await query(`SHOW COLUMNS FROM institute_enrollments LIKE 'status'`);
  const statusType = enrollmentCols[0]?.Type || '';
  if (!statusType.includes("'completed'")) {
    await query(`
      ALTER TABLE institute_enrollments
      MODIFY COLUMN status ENUM('active', 'suspended', 'completed', 'graduated', 'withdrawn') NOT NULL DEFAULT 'active'
    `);
    console.log('✓ Added completed enrollment status');
  }

  // Backfill the new explicit links once from the old order. This preserves
  // existing configuration while making all future decisions data-driven.
  const classes = await query(`
    SELECT id, progression_order, is_final_class
    FROM institute_classes
    WHERE is_active = 1
    ORDER BY progression_order ASC, id ASC
  `);
  for (let index = 0; index < classes.length; index += 1) {
    const current = classes[index];
    const next = classes[index + 1];
    if (!current.is_final_class && next) {
      await query(`UPDATE institute_classes SET next_class_id = COALESCE(next_class_id, ?) WHERE id = ?`, [next.id, current.id]);
    }
  }
  console.log('✓ Backfilled explicit next-class links without overwriting existing links');

  await query(`
    CREATE TABLE IF NOT EXISTS promotion_result_confirmations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      class_id INT NOT NULL,
      academic_year VARCHAR(30) NOT NULL,
      confirmed_by INT NOT NULL,
      confirmation_note TEXT NULL,
      confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES institute_classes(id) ON DELETE RESTRICT,
      FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE RESTRICT,
      UNIQUE KEY uk_promotion_result_confirmation (class_id, academic_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ Created promotion_result_confirmations');
  console.log('Automatic promotion migration completed successfully.');
}

if (process.argv[1]?.endsWith('migrate_automatic_promotions.js')) {
  runAutomaticPromotionsMigration()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Automatic promotion migration failed:', error);
      process.exit(1);
    });
}
