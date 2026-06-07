const express = require('express');
const router = express.Router();
const typeController = require('../controllers/typeController');
const validateType = require('../validators/typeValidator');

// Routes
router.get('/', typeController.getAllTypes);
router.get('/:id', typeController.getTypeById);
router.post('/', validateType, typeController.createType);
router.put('/:id', validateType, typeController.updateType);
router.delete('/:id', typeController.deleteType);

module.exports = router;
