const express = require('express');
const router = express.Router();
const wingController = require('../controllers/wingController');
const { validateCreateWing, validateUpdateWing, validateWingId } = require('../middlewares/wingValidate');

// CRUD routes
router.post('/', validateCreateWing, wingController.createWing);
router.get('/', wingController.getWings);
router.get('/:id', validateWingId, wingController.getWingById);
router.put('/:id', validateWingId, validateUpdateWing, wingController.updateWing);
router.delete('/:id', validateWingId, wingController.deleteWing);

module.exports = router;