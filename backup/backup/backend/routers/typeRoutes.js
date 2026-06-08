const express = require('express');
const router = express.Router();
const typeController = require('../controllers/typeController');
const validateType = require('../validators/typeValidator');
const authenticate = require('../middlewares/auth');
const { requireAdmin } = require('../middlewares/rbac');

// Reads: any authenticated user. Writes: Admin only.
router.get('/', authenticate, typeController.getAllTypes);
router.get('/:id', authenticate, typeController.getTypeById);
router.post('/', authenticate, requireAdmin, validateType, typeController.createType);
router.put('/:id', authenticate, requireAdmin, validateType, typeController.updateType);
router.delete('/:id', authenticate, requireAdmin, typeController.deleteType);

module.exports = router;
