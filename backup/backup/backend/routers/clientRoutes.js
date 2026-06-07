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

// ⚠️  /resolve must be declared BEFORE /:id — otherwise Express matches "resolve" as an id
router.post('/resolve', validate(resolveClientSchema), resolveClientId); // name → id

router.get('/',    getClients);                              // GET  all clients
router.get('/:id', getClientById);                          // GET  client by id
router.post('/',   validate(clientSchema), createClient);   // POST create
router.put('/:id', validate(clientSchema), editClient);     // PUT  update
router.delete('/:id', removeClient);                        // DELETE

module.exports = router;