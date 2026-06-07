const Joi = require('joi');

// Used for POST /clients and PUT /clients/:id
const clientSchema = Joi.object({
  client_name: Joi.string().trim().min(1).max(255).required().messages({
    'string.empty': 'client_name is required',
    'string.max':   'client_name must be at most 255 characters',
    'any.required': 'client_name is required',
  }),
});

// Used for POST /clients/resolve (name → id lookup)
const resolveClientSchema = Joi.object({
  client_name: Joi.string().trim().min(1).max(255).required().messages({
    'string.empty': 'client_name is required',
    'any.required': 'client_name is required',
  }),
});

module.exports = { clientSchema, resolveClientSchema };