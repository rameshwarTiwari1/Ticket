const Joi = require('joi');

const createLocationSchema = Joi.object({
    location_name: Joi.string().min(2).max(100).required()
});

const updateLocationSchema = Joi.object({
    location_name: Joi.string().min(2).max(100).required()
});

module.exports = {
    createLocationSchema,
    updateLocationSchema
};