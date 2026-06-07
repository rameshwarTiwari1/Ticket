const Comment = require('../models/commentModel');
const db      = require('../config/db');
const { createNotification } = require('../utils/notification');
const Ticket = require('../models/ticketModel');
const access = require('../utils/access');

// POST /tickets-generate/:id/comments
// Allowed: Admin, the Manager of the ticket's team+location, the assigned
// Employee, or the ticket owner (requester) — README §3.
exports.addComment = async (req, res) => {
  try {
    const ticket_id = req.params.id;
    const { comment_text } = req.body;

    if (!comment_text || !comment_text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const ticket = await Ticket.getTicketById(ticket_id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    const isOwner = Number(ticket.created_by_id) === Number(req.user.userId);
    if (!access.canWorkTicket(req.user, ticket) && !isOwner) {
      return res.status(403).json({ message: 'You are not allowed to comment on this ticket' });
    }

    // Get commenter details (LEFT JOIN: requesters may have no team).
    const userRow = await db.query(
      `SELECT u.register_id, u.first_name, u.last_name, t.team_name
       FROM T_USER u
       LEFT JOIN T_TEAMS t ON t.team_id = u.team_id
       WHERE u.register_id = $1`,
      [req.user.userId]
    );
    if (!userRow.rows[0]) return res.status(404).json({ message: 'User not found' });
    const user = userRow.rows[0];

    const comment = await Comment.addComment({
      ticket_id,
      user_id:      user.register_id,
      user_name:    `${user.first_name} ${user.last_name}`,
      team_name:    user.team_name || null,
      comment_text: comment_text.trim(),
    });

    // Notify the owner and the assignee (whoever isn't the commenter).
    const ownerId    = ticket.created_by_id;
    const assigneeId = ticket.assigned_to_id;
    if (ownerId && Number(ownerId) !== Number(user.register_id)) {
      await createNotification(ownerId, ticket_id, 'New comment added on your ticket');
    }
    if (assigneeId && Number(assigneeId) !== Number(user.register_id)
        && Number(assigneeId) !== Number(ownerId)) {
      await createNotification(assigneeId, ticket_id, 'New comment on a ticket assigned to you');
    }

    res.status(201).json({ message: 'Comment added successfully', comment });
  } catch (error) {
    console.error('ADD COMMENT ERROR:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// GET /tickets-generate/:id/comments
exports.getComments = async (req, res) => {
  try {
    const comments = await Comment.getCommentsByTicketId(req.params.id);
    res.status(200).json(comments);
  } catch (error) {
    console.error('GET COMMENTS ERROR:', error.message);
    res.status(500).json({ message: error.message });
  }
};