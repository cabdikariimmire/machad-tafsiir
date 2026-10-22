import { query } from '../backend/src/db/connection.js';

/**
 * Safe financial refactor migration.
 *
 * Adds an obligation type without rewriting historical rows. Existing invoices
 * remain monthly obligations through the column default. The legacy
 * payment_method column, if present in an already-mutated database, is left in
 * place for historical compatibility but is no longer read or written by the
 * application.
 */
async function columnExists(tableName, columnName) {
  const rows = await query(
    `SELECT COUNT(*) AS count
       FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function indexExists(tableName, indexName) {
  const rows = await query(
    `SELECT COUNT(*) AS count
       FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [tableName, indexName]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function migrate() {
  if (!(await columnExists('fee_rules', 'fee_type'))) {
    await query(`
      ALTER TABLE fee_rules
      ADD COLUMN fee_type ENUM('monthly', 'registration') NOT NULL DEFAULT 'monthly' AFTER division
    `);
  }

  if (!(await columnExists('fee_invoices', 'fee_type'))) {
    await query(`
      ALTER TABLE fee_invoices
      ADD COLUMN fee_type ENUM('monthly', 'registration') NOT NULL DEFAULT 'monthly' AFTER division
    `);
  }

  if (await indexExists('fee_invoices', 'uk_invoice_period')) {
    // InnoDB may currently be using the legacy composite index to support the
    // student_id foreign key. Add a dedicated supporting index before dropping it.
    if (!(await indexExists('fee_invoices', 'idx_fee_invoice_student'))) {
      await query(`ALTER TABLE fee_invoices ADD INDEX idx_fee_invoice_student (student_id)`);
    }
    await query(`ALTER TABLE fee_invoices DROP INDEX uk_invoice_period`);
  }

  if (!(await indexExists('fee_invoices', 'uk_invoice_obligation'))) {
    await query(`
      ALTER TABLE fee_invoices
      ADD UNIQUE KEY uk_invoice_obligation (student_id, division, fee_type, billing_period)
    `);
  }

  await query(`ALTER TABLE payments ADD INDEX idx_payment_receipt_date (receipt_number, payment_date)`)
    .catch((error) => {
      if (!/duplicate key name|duplicate key/i.test(error.message || '')) throw error;
    });

  console.log('Financial refactor migration completed without rewriting historical transactions.');
}

migrate().then(() => process.exit(0)).catch((error) => {
  console.error('Financial refactor migration failed:', error);
  process.exit(1);
});
