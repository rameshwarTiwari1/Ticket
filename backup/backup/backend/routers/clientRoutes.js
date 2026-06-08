const express = require('express');
const router = express.Router();

const {
  getClients,
  getClientById,
  resolveClientId,
  createClient,
  editClient,
  removeClient,
} = require('../controllers/clientController');

const { validate } = require('../middlewares/clientValidate');
const { clientSchema, resolveClientSchema } = require('../validators/clientValidator');
const authenticate = require('../middlewares/auth');
const { requireAdmin } = require('../middlewares/rbac');

// ⚠️  /resolve must be declared BEFORE /:id — otherwise Express matches "resolve" as an id
router.post('/resolve', authenticate, validate(resolveClientSchema), resolveClientId); // name → id

// Reads: any authenticated user. Writes: Admin only.
router.get('/',    authenticate, getClients);
router.get('/:id', authenticate, getClientById);
router.post('/',   authenticate, requireAdmin, validate(clientSchema), createClient);
router.put('/:id', authenticate, requireAdmin, validate(clientSchema), editClient);
router.delete('/:id', authenticate, requireAdmin, removeClient);

module.exports = router;
