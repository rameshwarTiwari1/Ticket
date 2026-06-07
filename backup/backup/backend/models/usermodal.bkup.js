const db     = require('../config/db');
const bcrypt = require('bcrypt');

// ==================== HELPERS ====================

const userExists = async (userId) => {
  const res = await db.query(
    `SELECT 1 FROM T_USER WHERE register_id = $1 LIMIT 1`, [userId]
  );
  return res.rows.length > 0;
};

const getUserEmailById = async (userId) => {
  const { rows } = await db.query(
    `SELECT email_id FROM T_USER WHERE register_id = $1 LIMIT 1`, [userId]
  );
  return rows[0]?.email_id || null;
};

const getTeamIdByName = async (team_name) => {
  const result = await db.query(
    `SELECT team_id FROM T_TEAMS WHERE LOWER(TRIM(team_name)) = LOWER(TRIM($1))`,
    [team_name]
  );
  return result.rows[0] || null;
};

const getLocationIdByName = async (location_name) => {
  const result = await db.query(
    `SELECT location_id FROM T_LOCATIONS WHERE LOWER(TRIM(location_name)) = LOWER(TRIM($1))`,
    [location_name]
  );
  return result.rows[0] || null;
};

const getWingIdByName = async (wing_name, location_id) => {
  const result = await db.query(
    `SELECT wing_id FROM T_WINGS WHERE wing_name = $1 AND location_id = $2`,
    [wing_name, location_id]
  );
  return result.rows[0] || null;
};

// Resolve org_name → org_id
const getOrgIdByName = async (org_name) => {
  if (!org_name) return null;
  const result = await db.query(
    `SELECT org_id FROM T_ORGANIZATION
     WHERE LOWER(TRIM(org_name)) = LOWER(TRIM($1))
     LIMIT 1`,
    [org_name]
  );
  return result.rows[0]?.org_id || null;
};

// ==================== SHARED FRAGMENTS ====================

const USER_SELECT = `
  r.register_id,
  r.employee_id,
  r.first_name,
  r.last_name,
  r.mobile_number,
  r.email_id,
  t.team_name,
  COALESCE(l.location_name, NULL) AS location_name,
  COALESCE(w.wing_name, NULL)     AS wing_name,
  r.org_id,
  COALESCE(o.org_name, NULL)      AS org_name
`;

const USER_JOINS = `
  JOIN  T_TEAMS        t  ON r.team_id     = t.team_id
  LEFT JOIN T_LOCATIONS l  ON r.location_id = l.location_id
  LEFT JOIN T_WINGS     w  ON r.wing_id     = w.wing_id
  LEFT JOIN T_ORGANIZATION o ON r.org_id   = o.org_id
`;

// ==================== FIND ====================

const findUserByEmail = async (email) => {
  const result = await db.query(
    `SELECT ${USER_SELECT}, r.password_hash
     FROM T_USER r ${USER_JOINS}
     WHERE r.email_id = $1`,
    [email]
  );
  return result.rows[0] || null;
};

const findUserById = async (id) => {
  const result = await db.query(
    `SELECT ${USER_SELECT}
     FROM T_USER r ${USER_JOINS}
     WHERE r.register_id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const getAllUsers = async () => {
  const result = await db.query(
    `SELECT ${USER_SELECT}
     FROM T_USER r ${USER_JOINS}
     ORDER BY r.register_id`
  );
  return result.rows;
};

const getUsersByOrg = async (org_id) => {
  const result = await db.query(
    `SELECT ${USER_SELECT}
     FROM T_USER r ${USER_JOINS}
     WHERE r.org_id = $1
     ORDER BY r.register_id`,
    [org_id]
  );
  return result.rows;
};

// ==================== CREATE ====================

/*
  Accepts EITHER:
    - org_id   (number)  — direct FK
    - org_name (string)  — resolved to org_id internally
  org_name takes precedence if both are provided.
*/
const addUser = async (data) => {
  try {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Resolve location_id
    let location_id = null;
    if (data.location_name) {
      const loc = await getLocationIdByName(data.location_name);
      if (loc) location_id = loc.location_id;
    }

    // Resolve wing_id
    let wing_id = null;
    if (data.wing_name && location_id) {
      const wing = await getWingIdByName(data.wing_name, location_id);
      if (wing) wing_id = wing.wing_id;
    }

    // Resolve org_id from name (registration sends name, admin sends id)
    let org_id = data.org_id || null;
    if (data.org_name) {
      const resolvedOrgId = await getOrgIdByName(data.org_name);
      if (!resolvedOrgId) throw new Error(`Organization "${data.org_name}" not found`);
      org_id = resolvedOrgId;
    }

    const result = await db.query(
      `INSERT INTO T_USER
         (employee_id, first_name, last_name, email_id, mobile_number,
          password_hash, team_id, location_id, wing_id, org_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING register_id, employee_id, first_name, last_name,
                 mobile_number, email_id, team_id, location_id, wing_id, org_id`,
      [
        data.employee_id,
        data.first_name,
        data.last_name,
        data.email_id,
        data.mobile_number,
        hashedPassword,
        data.team_id,
        location_id,
        wing_id,
        org_id,
      ]
    );
    return result.rows[0];
  } catch (err) {
    throw err;
  }
};

// ==================== UPDATE ====================

const updateUser = async (id, {
  first_name, last_name, mobile_number, email_id,
  password, team_name,
  location_name = null, wing_name = null,
  org_id = null, org_name = null,
}) => {
  try {
    const team = await getTeamIdByName(team_name);
    if (!team) throw new Error(`Invalid team name: ${team_name}`);

    let location_id = null;
    let wing_id     = null;

    if (location_name) {
      const location = await getLocationIdByName(location_name);
      // ✅ Don't throw — just skip if not found
      if (location) location_id = location.location_id;
    }

    if (wing_name && location_id) {
      const wing = await getWingIdByName(wing_name, location_id);
      // ✅ Don't throw — just skip if not found
      if (wing) wing_id = wing.wing_id;
    }

    // ✅ Resolve org_name → org_id safely (no throw if not found)
    let resolved_org_id = org_id || null;
    if (org_name) {
      const fromName = await getOrgIdByName(org_name);
      resolved_org_id = fromName || null; // ✅ null instead of throwing
    }

    let query, values;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = `
        UPDATE T_USER
        SET first_name    = $1,
            last_name     = $2,
            mobile_number = $3,
            email_id      = $4,
            password_hash = $5,
            team_id       = $6,
            location_id   = $7,
            wing_id       = $8,
            org_id        = $9
        WHERE register_id = $10
        RETURNING register_id, employee_id, first_name, last_name,
                  mobile_number, email_id, org_id
      `;
      values = [
        first_name, last_name, mobile_number, email_id,
        hashedPassword, team.team_id, location_id, wing_id,
        resolved_org_id, id,
      ];
    } else {
      query = `
        UPDATE T_USER
        SET first_name    = $1,
            last_name     = $2,
            mobile_number = $3,
            email_id      = $4,
            team_id       = $5,
            location_id   = $6,
            wing_id       = $7,
            org_id        = $8
        WHERE register_id = $9
        RETURNING register_id, employee_id, first_name, last_name,
                  mobile_number, email_id, org_id
      `;
      values = [
        first_name, last_name, mobile_number, email_id,
        team.team_id, location_id, wing_id, resolved_org_id, id,
      ];
    }

    const result = await db.query(query, values);
    if (!result.rows[0]) return null;

    return {
      ...result.rows[0],
      team_name,
      location_name: location_name || null,
      wing_name:     wing_name     || null,
      org_id:        resolved_org_id,
    };
  } catch (err) {
    throw err;
  }
};

// ==================== DELETE ====================

const deleteUser = async (userId, newUserId) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const assignedTickets = await client.query(
      `SELECT t.ticket_id, s.status_name
       FROM t_tickets t
       LEFT JOIN ticket_status s ON t.status_id = s.status_id
       WHERE t.assigned_to = $1`,
      [userId]
    );

    const pendingTickets = assignedTickets.rows.filter(t =>
      ['open', 'in progress', 'reopened'].includes(
        (t.status_name || '').toLowerCase()
      )
    );

    if (pendingTickets.length > 0 && !newUserId) {
      await client.query('ROLLBACK');
      const err = new Error(
        `User has ${pendingTickets.length} pending ticket(s). Please reassign them first.`
      );
      err.requiresReassign = true;
      err.pendingCount     = pendingTickets.length;
      throw err;
    }

    if (assignedTickets.rows.length > 0 && newUserId) {
      await client.query(
        `UPDATE t_tickets SET assigned_to = $1 WHERE assigned_to = $2`,
        [newUserId, userId]
      );
    }

    await client.query(
      `UPDATE t_tickets SET created_by = NULL WHERE created_by = $1`, [userId]
    );
    await client.query(
      `DELETE FROM T_USER WHERE register_id = $1`, [userId]
    );

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  findUserByEmail,
  findUserById,
  getAllUsers,
  getUsersByOrg,
  addUser,
  updateUser,
  deleteUser,
  userExists,
  getUserEmailById,
};