const Joi = require('joi');

// Schemas
const wingIdSchema = Joi.object({ id: Joi.number().integer().positive().required() });
const createWingSchema = Joi.object({
    wing_name: Joi.string().min(2).max(100).required(),
    location_id: Joi.number().integer().positive().required()
});
const updateWingSchema = createWingSchema;

// Middleware
const validateWingId = (req, res, next) => {
    const { error } = wingIdSchema.validate(req.params);
    if (error) return res.status(400).json({ message: error.details[0].message });
    next();
};

const validateCreateWing = (req, res, next) => {
    const { error } = createWingSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });
    next();
};

const validateUpdateWing = (req, res, next) => {
    const { error } = updateWingSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });
    next();
};
module.exports = { validateWingId, validateCreateWing, validateUpdateWing };