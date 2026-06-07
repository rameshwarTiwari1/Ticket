const db = require('../config/db');

// Add a comment to a ticket
exports.addComment = async ({ ticket_id, user_id, user_name, team_name, comment_text }) => {
  const { rows } = await db.query(`
    INSERT INTO ticket_comments (ticket_id, user_id, user_name, team_name, comment_text)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [ticket_id, user_id, user_name, team_name, comment_text]);
  return rows[0];
};

// Get all comments for a ticket
exports.getCommentsByTicketId = async (ticket_id) => {
  const { rows } = await db.query(`
    SELECT * FROM ticket_comments
    WHERE ticket_id = $1
    ORDER BY created_at ASC
  `, [ticket_id]);
  return rows;
};