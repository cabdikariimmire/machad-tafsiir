import { query } from '../db/connection.js';

/**
 * Log an audit action to the database
 */
export async function logAudit({
  userId,
  action,
  module,
  division = 'system',
  recordId = null,
  details = null,
  beforeValue = null,
  afterValue = null,
  ipAddress = null
}) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, module, division, record_id, details, before_value, after_value, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        action,
        module,
        division,
        recordId ? String(recordId) : null,
        details || null,
        beforeValue ? JSON.stringify(beforeValue) : null,
        afterValue ? JSON.stringify(afterValue) : null,
        ipAddress || null
      ]
    );
  } catch (error) {
    console.error('[Audit Log Error]:', error.message);
  }
}
