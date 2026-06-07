const Joi = require('joi');

// ─── HELPER: allows comma-separated emails OR single email ───────────────────
// We store email_id as a free-text CC field (can be comma-separated)
const commaSeparatedEmailOrString = Joi.string()
  .custom((value, helpers) => {
    if (!value || value.trim() === '') return value;
    // Strip trailing commas/spaces, then validate each part
    const emails = value
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of emails) {
      if (!emailRegex.test(email)) {
        return helpers.error('any.invalid');
      }
    }
    return emails.join(', '); // normalize: clean up trailing commas
  })
  .allow('', null)
  .optional();

// ─── CREATE TICKET ───────────────────────────────────────────────────────────
const createTicketSchema = Joi.object({
  subject:           Joi.string().required(),
  email_id:          commaSeparatedEmailOrString,   // ✅ allows comma-separated
  created_by_name:   Joi.string().required(),
  assigned_to_name:  Joi.string().allow('', null).optional(),
  assigned_to_user: Joi.string().allow('', null).optional(),
  assigned_to_email: Joi.string().allow('', null).optional(),  // ✅ no .email() — can be team name
  type_name:         Joi.string().required(),
  issue_name:        Joi.string().required(),
  team_name:         Joi.string().allow('', null).optional(),
  status_name:       Joi.string().allow('', null).optional(),  // server forces 'Pending Approval'
  priority:          Joi.string().valid('Low', 'Medium', 'High').required(),
  description:       Joi.string().allow('', null).optional(),
  additional_email:  Joi.string().allow('', null).optional(),
  client_name:       Joi.string().allow('', null).optional(),
  org_name:          Joi.string().allow('', null).optional(),
  approver_email:    Joi.string().allow('', null).optional(),  // approver picked on the form
  wing_id:   Joi.number().integer().allow(null).optional(),
wing_name: Joi.string().allow('', null).optional(),
desk_number: Joi.string().allow('', null).optional(),
location_id: Joi.string().allow('', null),
created_at_location_id: Joi.number().allow(null),
}).options({ stripUnknown: false });

// ─── UPDATE TICKET ───────────────────────────────────────────────────────────
const updateTicketSchema = Joi.object({
  subject:           Joi.string().optional(),
  email_id:          commaSeparatedEmailOrString,   // ✅ same fix
  priority:          Joi.string().valid('Low', 'Medium', 'High').optional(),
  description:       Joi.string().allow('', null).optional(),
  assigned_to_name:  Joi.string().allow('', null).optional(),
  assigned_to_email: Joi.string().allow('', null).optional(),
  type_name:         Joi.string().optional(),
  issue_name:        Joi.string().optional(),
  team_name:         Joi.string().optional(),
  status_name:       Joi.string().optional(),
  additional_email:  Joi.string().allow('', null).optional(),
  client_name:       Joi.string().allow('', null).optional(),
  org_name:          Joi.string().allow('', null).optional(),
}).options({ stripUnknown: true });

// ─── ASSIGN TICKET ───────────────────────────────────────────────────────────
const assignTicketSchema = Joi.object({
  ticket_id:          Joi.number().integer().required(),
  org_name:           Joi.string().allow('', null).optional(),
  assigned_to:        Joi.alternatives()
                        .try(Joi.number().integer(), Joi.string())
                        .required(),
  estimated_end_date: Joi.string().allow('', null).optional(),
  remark:             Joi.string().allow('', null).optional(),
}).options({ stripUnknown: true });

module.exports = { createTicketSchema, updateTicketSchema, assignTicketSchema };