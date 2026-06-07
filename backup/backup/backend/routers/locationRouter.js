const express = require('express');
const router = express.Router();

const locationController = require('../controllers/locationController');
const validate = require('../middlewares/locationValidate');
const {
    createLocationSchema,
    updateLocationSchema
} = require('../validators/locationValidator');

// CREATE
router.post(
    '/',
    validate(createLocationSchema),
    locationController.createLocation
);

// READ ALL
router.get('/', locationController.getLocations);

// READ ONE
router.get('/:id', locationController.getLocationById);

// UPDATE
router.put(
    '/:id',
    validate(updateLocationSchema),
    locationController.updateLocation
);

// DELETE
router.delete('/:id', locationController.deleteLocation);

module.exports = router;