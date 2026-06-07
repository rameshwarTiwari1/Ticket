const express = require('express');
const router  = express.Router();
const {
  login,
  getUserById,
  getUsers,
  createUser,
  editUser,
  removeUser,
  reassignTickets,
  deleteUserWithReassign,
  setRole,
  transferLocation,
  getAssignableUsers,
} = require('../controllers/userController');
const authenticate = require('../middlewares/auth');
const { requireAdmin, requireManagerOrAdmin } = require('../middlewares/rbac');
const pool = require('../config/db');

// ─── PUBLIC ───────────────────────────────────────────────────────────────────
router.post('/login', login);

// ─── ANY AUTHENTICATED USER ───────────────────────────────────────────────────
router.get('/emails', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT email_id AS email FROM T_USER ORDER BY first_name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch emails' });
  }
});

// Employees a Manager/Admin may assign tickets to (own team + location).
router.get('/assignable', authenticate, requireManagerOrAdmin, getAssignableUsers);

// GET own / a user's profile.
router.get('/:id', authenticate, getUserById);

// ─── MANAGER + ADMIN ──────────────────────────────────────────────────────────
router.get('/', authenticate, requireManagerOrAdmin, getUsers);
// Bulk reassign-all-from-one-user is part of the user-deletion flow → Admin only.
router.post('/reassign',                 authenticate, requireAdmin, reassignTickets);
router.post('/delete-with-reassign/:id', authenticate, requireAdmin,          deleteUserWithReassign);

// ─── ADMIN ONLY ───────────────────────────────────────────────────────────────
router.post('/',            authenticate, requireAdmin, createUser);
router.put('/:id',          authenticate, requireAdmin, editUser);
router.delete('/:id',       authenticate, requireAdmin, removeUser);
router.put('/:id/role',     authenticate, requireAdmin, setRole);          // promote to Manager etc.
router.put('/:id/transfer', authenticate, requireAdmin, transferLocation); // change location

module.exports = router;
