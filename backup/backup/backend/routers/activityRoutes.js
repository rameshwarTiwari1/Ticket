const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/auth');
const { requireManagerOrAdmin } = require('../middlewares/rbac');
const activity = require('../utils/activityLog');
const access = require('../utils/access');

router.use(authenticate);

// Activity logs — Admin sees all; Manager sees their own org's logs.
router.get('/', requireManagerOrAdmin, async (req, res) => {
  try {
    const filters = { activity_type: req.query.type };
    if (!access.isAdmin(req.user)) filters.org_id = req.user.org_id;   // managers: own org only
    else if (req.query.org_id) filters.org_id = req.query.org_id;
    const rows = await activity.list(filters);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
