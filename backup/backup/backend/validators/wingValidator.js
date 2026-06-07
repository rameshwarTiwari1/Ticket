const Joi = require('joi');

const createWingSchema = Joi.object({
    wing_name: Joi.string().min(2).max(100).required(),
    location_id: Joi.number().integer().required()
});

const updateWingSchema = Joi.object({
    wing_name: Joi.string().min(2).max(100).required(),
    location_id: Joi.number().integer().required()
});

module.exports = {
    createWingSchema,
    updateWingSchema
};