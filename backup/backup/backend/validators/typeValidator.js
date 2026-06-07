const Joi = require('joi');

// Validation schema for creating/updating a type
const typeSchema = Joi.object({
    type_name: Joi.string()
        .min(2)
        .max(50)
        .required()
        .messages({
            'string.base': 'Type name must be a string',
            'string.empty': 'Type name is required',
            'string.min': 'Type name must be at least 2 characters',
            'string.max': 'Type name must be at most 50 characters',
            'any.required': 'Type name is required'
        })
});

// Middleware for validating request body
const validateType = (req, res, next) => {
    const { error } = typeSchema.validate(req.body, { abortEarly: false });
    if (error) {
        const messages = error.details.map((detail) => detail.message);
        return res.status(400).json({ errors: messages });
    }
    next();
};

module.exports = validateType;
