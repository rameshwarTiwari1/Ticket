const express = require('express');
const router  = express.Router();
const authenticate = require('../middlewares/auth');
const {
  getUserNotifications, markRead, markAllRead,
} = require('../utils/notification');

router.use(authenticate);

// List the caller's notifications (?unread=true for unread only).
router.get('/', async (req, res) => {
  try {
    const rows = await getUserNotifications(req.user.userId, req.query.unread === 'true');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    const row = await markRead(req.params.id, req.user.userId);
    if (!row) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Marked read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/read-all', async (req, res) => {
  try {
    await markAllRead(req.user.userId);
    res.json({ message: 'All marked read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
