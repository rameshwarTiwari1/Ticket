const express = require('express');
const router = express.Router();
const ticketStatusController = require('../controllers/statusController');
const { ticketStatusSchema, ticketStatusIdSchema, validateBody, validateParams } = require('../validators/statusValidator');

// CRUD routes with Joi validation
router.get('/', ticketStatusController.getAll);
router.get('/:id', validateParams(ticketStatusIdSchema), ticketStatusController.getById);
router.post('/', validateBody(ticketStatusSchema), ticketStatusController.create);
router.put('/:id', validateParams(ticketStatusIdSchema), validateBody(ticketStatusSchema), ticketStatusController.update);
router.delete('/:id', validateParams(ticketStatusIdSchema), ticketStatusController.delete);

module.exports = router;
