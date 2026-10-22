import { query } from '../db/connection.js';

/**
 * Create an in-app notification
 * If userId is null, it broadcasts to Super Admins (and relevant Admins)
 */
export async function createNotification({
  userId = null,
  type,
  title,
  message,
  division = 'system',
  metadata = null
}) {
  try {
    await query(
      `INSERT INTO notifications (user_id, type, title, message, division, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        type,
        title,
        message,
        division,
        metadata ? JSON.stringify(metadata) : null
      ]
    );
  } catch (error) {
    console.error('[Notification Error]:', error.message);
  }
}
