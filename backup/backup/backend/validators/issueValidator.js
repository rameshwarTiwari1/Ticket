const Joi = require("joi");

const issueSchema = Joi.object({
  issue_name: Joi.string().max(150).required(),
  type_id: Joi.number().integer().required(),
  mapped_team_id: Joi.number().integer().required(),
});

module.exports = issueSchema;
