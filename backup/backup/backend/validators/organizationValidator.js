// backend/validators/organizationValidator.js
const Joi = require('joi');

const createOrganizationSchema = Joi.object({
  org_name: Joi.string().trim().required().messages({
    'string.empty': 'Organization name is required',
    'any.required': 'Organization name is required',
  }),
  location_id: Joi.number().integer().positive().required().messages({
    'number.base': 'Location ID must be a number',
    'any.required': 'Location ID is required',
  }),
});

const updateOrganizationSchema = Joi.object({
  org_name:    Joi.string().trim().optional(),
  location_id: Joi.number().integer().positive().optional(),
});

module.exports = { createOrganizationSchema, updateOrganizationSchema };