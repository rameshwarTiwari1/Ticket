const express = require('express');
const router = express.Router();
const wingController = require('../controllers/wingController');
const { validateCreateWing, validateUpdateWing, validateWingId } = require('../middlewares/wingValidate');
const authenticate = require('../middlewares/auth');
const { requireAdmin } = require('../middlewares/rbac');

// Reads: any authenticated user. Writes: Admin only.
router.get('/', authenticate, wingController.getWings);
router.get('/:id', authenticate, validateWingId, wingController.getWingById);
router.post('/', authenticate, requireAdmin, validateCreateWing, wingController.createWing);
router.put('/:id', authenticate, requireAdmin, validateWingId, validateUpdateWing, wingController.updateWing);
router.delete('/:id', authenticate, requireAdmin, validateWingId, wingController.deleteWing);

module.exports = router;
