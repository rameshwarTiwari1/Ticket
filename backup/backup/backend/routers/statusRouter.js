const express = require('express');
const router = express.Router();
const ticketStatusController = require('../controllers/statusController');
const { ticketStatusSchema, ticketStatusIdSchema, validateBody, validateParams } = require('../validators/statusValidator');
const authenticate = require('../middlewares/auth');
const { requireAdmin } = require('../middlewares/rbac');

// Reads: any authenticated user. Writes: Admin only.
router.get('/', authenticate, ticketStatusController.getAll);
router.get('/:id', authenticate, validateParams(ticketStatusIdSchema), ticketStatusController.getById);
router.post('/', authenticate, requireAdmin, validateBody(ticketStatusSchema), ticketStatusController.create);
router.put('/:id', authenticate, requireAdmin, validateParams(ticketStatusIdSchema), validateBody(ticketStatusSchema), ticketStatusController.update);
router.delete('/:id', authenticate, requireAdmin, validateParams(ticketStatusIdSchema), ticketStatusController.delete);

module.exports = router;
