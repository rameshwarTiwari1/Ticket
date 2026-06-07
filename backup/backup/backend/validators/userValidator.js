const Joi = require('joi');

const loginSchema = Joi.object({
  email:    Joi.string().email().required(),
  password: Joi.string().required(),
});

const userSchema = Joi.object({
  employee_id: Joi.string().required(),

  first_name: Joi.string().required(),
  last_name:  Joi.string().required(),

  mobile_number: Joi.string()
    .pattern(/^\d{10}$/)
    .required(),

  email_id: Joi.string().email().required(),

  password: Joi.string().required(),

  team_name: Joi.string().required(),

  // ✅ OPTIONAL (this is your requirement)
  location_name: Joi.string().optional().allow(null, ''),
  wing_name:     Joi.string().optional().allow(null, ''),

  org_name: Joi.string().optional().allow(null, ''),
  org_id:   Joi.number().optional().allow(null),
});

module.exports = { loginSchema, userSchema };