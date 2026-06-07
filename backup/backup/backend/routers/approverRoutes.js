const express = require('express');
const router  = express.Router();
const ctrl = require('../controllers/approverController');
const authenticate = require('../middlewares/auth');
const { requireAdmin, requireManagerOrAdmin } = require('../middlewares/rbac');

router.use(authenticate);

// Any authenticated user: approver choices for the ticket form (location-filtered).
router.get('/options', ctrl.options);

// Managers/Admins can view; only Admin can mutate the registry.
router.get('/',        requireManagerOrAdmin, ctrl.list);
router.post('/',       requireAdmin,          ctrl.create);
router.put('/:id',     requireAdmin,          ctrl.update);
router.delete('/:id',  requireAdmin,          ctrl.remove);

module.exports = router;
