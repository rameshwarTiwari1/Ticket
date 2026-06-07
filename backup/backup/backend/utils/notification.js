const db = require('../config/db');

exports.createNotification = async (userId, ticketId, message) => {
  try {
    if (!userId) return;
    await db.query(
      `INSERT INTO notifications (user_id, ticket_id, message, is_read, created_at)
       VALUES ($1, $2, $3, false, NOW())`,
      [userId, ticketId, message]
    );
  } catch (error) {
    console.error('NOTIFICATION ERROR:', error.message);
    // Don't throw — notification failure should not break the calling action
  }
};

exports.getUserNotifications = async (userId, onlyUnread = false) => {
  const { rows } = await db.query(
    `SELECT id, ticket_id, message, is_read, created_at
     FROM notifications
     WHERE user_id = $1 ${onlyUnread ? 'AND is_read = false' : ''}
     ORDER BY created_at DESC
     LIMIT 100`,
    [userId]
  );
  return rows;
};

exports.markRead = async (id, userId) => {
  const { rows } = await db.query(
    `UPDATE notifications SET is_read = true
     WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  return rows[0] || null;
};

exports.markAllRead = async (userId) => {
  await db.query(
    `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
  return true;
};
