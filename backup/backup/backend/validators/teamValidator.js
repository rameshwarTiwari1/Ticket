const Joi = require('joi');

const teamSchema = Joi.object({
  team_name: Joi.string().min(3).max(100).required(),
  location_id: Joi.number().integer().positive().optional(),
  location_name: Joi.string().optional().allow('', null)
});

module.exports = teamSchema;