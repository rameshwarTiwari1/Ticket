const express = require('express');
const router = express.Router();

const locationController = require('../controllers/locationController');
const validate = require('../middlewares/locationValidate');
const {
    createLocationSchema,
    updateLocationSchema
} = require('../validators/locationValidator');
const authenticate = require('../middlewares/auth');
const { requireAdmin } = require('../middlewares/rbac');

// READ: any authenticated user (needed for dropdowns).
router.get('/', authenticate, locationController.getLocations);
router.get('/:id', authenticate, locationController.getLocationById);

// WRITE: Admin only.
router.post('/', authenticate, requireAdmin, validate(createLocationSchema), locationController.createLocation);
router.put('/:id', authenticate, requireAdmin, validate(updateLocationSchema), locationController.updateLocation);
router.delete('/:id', authenticate, requireAdmin, locationController.deleteLocation);

module.exports = router;
