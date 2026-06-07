const Joi = require('joi');

// Schema for creating or updating a ticket status
const ticketStatusSchema = Joi.object({
  status_name: Joi.string()
    .max(50)
    .required()
    .messages({
      'string.empty': 'Status name is required',
      'string.max': 'Status name cannot exceed 50 characters'
    })
});

// Schema for validating ID param
const ticketStatusIdSchema = Joi.object({
  id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'ID must be a number',
      'number.integer': 'ID must be an integer',
      'number.positive': 'ID must be a positive integer',
      'any.required': 'ID is required'
    })
});

// Middleware to validate request body using a schema
const validateBody = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      errors: error.details.map((err) => ({ message: err.message, path: err.path }))
    });
  }
  next();
};

// Middleware to validate request params using a schema
const validateParams = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.params, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      errors: error.details.map((err) => ({ message: err.message, path: err.path }))
    });
  }
  next();
};

module.exports = {
  ticketStatusSchema,
  ticketStatusIdSchema,
  validateBody,
  validateParams
};
