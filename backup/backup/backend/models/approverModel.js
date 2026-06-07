// =============================================================================
// Approver registry — admin-managed list of approvers, mapped to location+team.
// The approver for a ticket is auto-resolved at creation (README §6).
// =============================================================================

const db = require('../config/db');

// Resolve the approver email for a ticket by location + team, with a
// location-level default fallback (team_id IS NULL). Returns email string|null.
const resolveApprover = async (locationId, teamId) => {
  if (!locationId) return null;

  // 1. Exact location + team match.
  if (teamId) {
    const exact = await db.query(
      `SELECT approver_email FROM t_approvers
       WHERE location_id = $1 AND team_id = $2 AND is_active = TRUE
       LIMIT 1`,
      [locationId, teamId]
    );
    if (exact.rows[0]) return exact.rows[0].approver_email;
  }

  // 2. Location-level default (team_id NULL, is_default).
  const def = await db.query(
    `SELECT approver_email FROM t_approvers
     WHERE location_id = $1 AND team_id IS NULL AND is_default = TRUE AND is_active = TRUE
     LIMIT 1`,
    [locationId]
  );
  return def.rows[0]?.approver_email || null;
};

// Approver options for the ticket form, filtered to one location (team-specific
// entries + the location default). Any authenticated user may read these.
const optionsForLocation = async (locationId) => {
  if (!locationId) return [];
  const { rows } = await db.query(
    `SELECT a.approver_id, a.approver_email, a.approver_name, a.team_id, a.is_default,
            t.team_name
     FROM t_approvers a
     LEFT JOIN t_teams t ON t.team_id = a.team_id
     WHERE a.location_id = $1 AND a.is_active = TRUE
     ORDER BY a.is_default DESC, t.team_name NULLS FIRST`,
    [locationId]
  );
  return rows;
};

// Is `email` a configured, active approver for `locationId`? (validates form input)
const isApproverForLocation = async (email, locationId) => {
  if (!email || !locationId) return false;
  const { rows } = await db.query(
    `SELECT 1 FROM t_approvers
     WHERE location_id = $1 AND LOWER(TRIM(approver_email)) = LOWER(TRIM($2)) AND is_active = TRUE
     LIMIT 1`,
    [locationId, email]
  );
  return rows.length > 0;
};

const listApprovers = async (filters = {}) => {
  const where = [];
  const vals = [];
  let i = 1;
  if (filters.org_id)      { where.push(`a.org_id = $${i++}`);      vals.push(filters.org_id); }
  if (filters.location_id) { where.push(`a.location_id = $${i++}`); vals.push(filters.location_id); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await db.query(
    `SELECT a.*, l.location_name, t.team_name, o.org_name
     FROM t_approvers a
     LEFT JOIN t_locations    l ON l.location_id = a.location_id
     LEFT JOIN t_teams        t ON t.team_id     = a.team_id
     LEFT JOIN t_organization o ON o.org_id      = a.org_id
     ${clause}
     ORDER BY l.location_name, t.team_name NULLS FIRST`,
    vals
  );
  return rows;
};

const createApprover = async (d) => {
  const { rows } = await db.query(
    `INSERT INTO t_approvers
       (org_id, location_id, team_id, approver_email, approver_name, is_default, is_active)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,FALSE),COALESCE($7,TRUE))
     RETURNING *`,
    [d.org_id || null, d.location_id, d.team_id || null,
     d.approver_email, d.approver_name || null, d.is_default, d.is_active]
  );
  return rows[0];
};

const updateApprover = async (id, d) => {
  const { rows } = await db.query(
    `UPDATE t_approvers SET
       org_id         = COALESCE($1, org_id),
       location_id    = COALESCE($2, location_id),
       team_id        = $3,
       approver_email = COALESCE($4, approver_email),
       approver_name  = COALESCE($5, approver_name),
       is_default     = COALESCE($6, is_default),
       is_active      = COALESCE($7, is_active),
       updated_at     = CURRENT_TIMESTAMP
     WHERE approver_id = $8
     RETURNING *`,
    [d.org_id ?? null, d.location_id ?? null, d.team_id ?? null,
     d.approver_email ?? null, d.approver_name ?? null,
     d.is_default ?? null, d.is_active ?? null, id]
  );
  return rows[0] || null;
};

const deleteApprover = async (id) => {
  const { rows } = await db.query(
    `DELETE FROM t_approvers WHERE approver_id = $1 RETURNING *`, [id]
  );
  return rows[0] || null;
};

module.exports = {
  resolveApprover, optionsForLocation, isApproverForLocation,
  listApprovers, createApprover, updateApprover, deleteApprover,
};
