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

// Teams are location-specific (the same name can exist at many locations).
// Resolve the team row by name AT the given location; fall back to a name-only
// match if no location-specific row exists. Returns a team_id or null.
const getTeamIdAtLocation = async (team_name, location_id) => {
  if (!team_name) return null;
  if (location_id) {
    const r = await db.query(
      `SELECT team_id FROM T_TEAMS
       WHERE LOWER(TRIM(team_name)) = LOWER(TRIM($1)) AND location_id = $2 LIMIT 1`,
      [team_name, location_id]
    );
    if (r.rows[0]) return r.rows[0].team_id;
  }
  const r2 = await db.query(
    `SELECT team_id FROM T_TEAMS WHERE LOWER(TRIM(team_name)) = LOWER(TRIM($1)) LIMIT 1`,
    [team_name]
  );
  return r2.rows[0]?.team_id || null;
};

const getLocationIdByName = async (location_name) => {
  const result = await db.query(
    `SELECT location_id FROM T_LOCATIONS WHERE LOWER(TRIM(location_name)) = LOWER(TRIM($1))`,
    [location_name]
  );
  return result.rows[0] || null;
};

//edit by chandramani
// const getWingIdByName = async (wing_name, location_id) => {
//   const result = await db.query(
//     `SELECT wing_id FROM T_WINGS WHERE wing_name = $1 AND location_id = $2`,
//     [wing_name, location_id]
//   );
//   return result.rows[0] || null;
// };

// If DB is down or query fails → unhandled exception bubbles up
// Fix
const getWingIdByName = async (wing_name, location_id) => {
  try {
    if (!wing_name || !location_id) return null;
    
    const result = await db.query(
      `SELECT wing_id, wing_name FROM T_WINGS 
       WHERE LOWER(wing_name) = LOWER($1) AND location_id = $2`,
      [wing_name, location_id]
    );
    return result.rows[0] || null;
    console.log(result);
  } catch (err) {
    console.error('getWingIdByName error:', err.message);
    throw err; // let caller handle it
  }
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
  r.role,
  r.team_id,
  t.team_name,
  r.location_id,
  COALESCE(l.location_name, NULL) AS location_name,
  COALESCE(w.wing_name, NULL)     AS wing_name,
  r.org_id,
  r.wing_id,

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

    // Resolve the team AT the user's location (teams are location-specific);
    // fall back to the controller-resolved id if no location-specific row exists.
    const team_id = (await getTeamIdAtLocation(data.team_name, location_id)) || data.team_id;

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

    // removed mobile number chandramani
    // Admin-created accounts default to 'employee'; Admin can pick the role on
    // the create form (admin/manager/employee/user).
    const allowedRoles = ['admin', 'manager', 'employee', 'user'];
    const role = allowedRoles.includes((data.role || '').toLowerCase())
      ? data.role.toLowerCase() : 'employee';

    const result = await db.query(
      `INSERT INTO T_USER
         (employee_id, first_name, last_name, email_id,
          password_hash, team_id, location_id, wing_id, org_id, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING register_id, employee_id, first_name, last_name,
                 email_id, team_id, location_id, wing_id, org_id, role`,
      [
        data.employee_id,
        data.first_name,
        data.last_name,
        data.email_id,
        // data.mobile_number,
        hashedPassword,
        team_id,
        location_id,
        wing_id,
        org_id,
        role,
      ]
    );
    return result.rows[0];
  } catch (err) {
    throw err;
  }
};

// ==================== UPDATE ====================

// const updateUser = async (id, {
//   first_name, last_name, mobile_number, email_id,
//   password, team_name,
//   location_name = null, wing_name = null,
//   org_id = null, org_name = null
// }) => {
//   try {
//     const team = await getTeamIdByName(team_name);
//     if (!team) throw new Error(`Invalid team name: ${team_name}`);

//     let location_id = null;
//     let wing_id     = null;
    

//     if (location_name) {
//       const location = await getLocationIdByName(location_name);
//       // ✅ Don't throw — just skip if not found
//       if (location) location_id = location.location_id;
//     }

//     if (wing_name && location_id) {
//       const wing = await getWingIdByName(wing_name, location_id);
//       console.log("Wing id",wing);
//       // ✅ Don't throw — just skip if not found
//       if (wing) wing_id = wing.wing_id;
//     }

//     // ✅ Resolve org_name → org_id safely (no throw if not found)
//     let resolved_org_id = org_id || null;
//     if (org_name) {
//       const fromName = await getOrgIdByName(org_name);
//       resolved_org_id = fromName || null; // ✅ null instead of throwing
//     }

//     let query, values;

//     if (password) {
//       const hashedPassword = await bcrypt.hash(password, 10);
//       query = `
//         UPDATE T_USER
//         SET first_name    = $1,
//             last_name     = $2,
//             mobile_number = $3,
//             email_id      = $4,
//             password_hash = $5,
//             team_id       = $6,
//             location_id   = $7,
//             wing_id       = $8,
//             org_id        = $9
//         WHERE register_id = $10
//         RETURNING register_id, employee_id, first_name, last_name,
//                   mobile_number, email_id, org_id
//       `;
//       values = [
//         first_name, last_name, mobile_number, email_id,
//         hashedPassword, finalTeamId, location_id, wing_id,
//         resolved_org_id, id,
//       ];
//     } else {
//       query = `
//         UPDATE T_USER
//         SET first_name    = $1,
//             last_name     = $2,
//             mobile_number = $3,
//             email_id      = $4,
//             team_id       = $5,
//             location_id   = $6,
//             wing_id       = $7,
//             org_id        = $8
//         WHERE register_id = $9
//         RETURNING register_id, employee_id, first_name, last_name,
//                   mobile_number, email_id, org_id
//       `;
//       values = [
//         first_name, last_name, mobile_number, email_id,
//         team.team_id, location_id, wing_id, resolved_org_id, id,
//       ];
//     }

//     const result = await db.query(query, values);
//     if (!result.rows[0]) return null;

//     return {
//       ...result.rows[0],
//       team_name,
//       location_name: location_name || null,
//       wing_name:     wing_name     || null,
//       org_id:        resolved_org_id,
//     };
//   } catch (err) {
//     throw err;
//   }
// };

const updateUser = async (id, {
  first_name, last_name, mobile_number, email_id,
  password, team_name, role = null,
  location_name = null, wing_name = null,
  org_id = null, org_name = null
}) => {
  try {
    console.log('\n======= updateUser CALLED =======');
    console.log('📥 INPUT:', { id, team_name, location_name, wing_name, org_name });

    // STEP 1 — Fetch existing user
    const existingResult = await db.query(
      `SELECT location_id, wing_id, org_id FROM T_USER WHERE register_id = $1`, [id]
    );
    const existing = existingResult.rows[0];
    if (!existing) throw new Error(`User with register_id ${id} not found`);
    console.log('📦 EXISTING:', existing);

    // STEP 2 — Resolve team
    const team = await getTeamIdByName(team_name);
    if (!team) throw new Error(`Invalid team name: ${team_name}`);

    // ─────────────────────────────────────────
    // STEP 3 — Resolve location_id
    // ─────────────────────────────────────────
    const ORG_LOCATION_MAP = {
      'Hansa Cequity': 'Mumbai Kurla',
      'Hansa Direct':  'Mumbai Airoli',
      'Autosense':     'Chennai',
    };

    let location_id = null;

    if (location_name) {
      // location explicitly sent
      const location = await getLocationIdByName(location_name);
      if (location) location_id = location.location_id;
      console.log('📍 location from location_name:', location_id);

    } else if (org_name) {
      // ✅ derive location from org_name
      const derivedLocation = ORG_LOCATION_MAP[org_name];
      console.log('📍 derived location from org:', derivedLocation);
      if (derivedLocation) {
        const location = await getLocationIdByName(derivedLocation);
        if (location) location_id = location.location_id;
      }
      console.log('📍 location_id from org_name:', location_id);

    } else {
      // preserve existing
      location_id = existing.location_id ?? null;
      console.log('📍 using existing location_id:', location_id);
    }

    // ─────────────────────────────────────────
    // STEP 4 — Resolve wing_id
    // ─────────────────────────────────────────
    let wing_id = null;

    if (wing_name && location_id) {
      // ✅ best case — both available
      const wing = await getWingIdByName(wing_name, location_id);
      console.log('🪽 WING lookup result:', wing);
      if (wing) wing_id = wing.wing_id;

    } else if (wing_name && !location_id) {
      // ✅ fallback — lookup by wing_name only
      const wingOnly = await db.query(
        `SELECT wing_id, wing_name, location_id
         FROM T_WINGS
         WHERE LOWER(wing_name) = LOWER($1)
         LIMIT 1`,
        [wing_name]
      );
      console.log('🪽 WING fallback lookup:', wingOnly.rows[0]);
      if (wingOnly.rows[0]) wing_id = wingOnly.rows[0].wing_id;

    } else {
      // preserve existing
      wing_id = existing.wing_id ?? null;
      console.log('🪽 using existing wing_id:', wing_id);
    }

    console.log('✅ FINAL location_id:', location_id, '| wing_id:', wing_id);

    // STEP 5 — Resolve org_id
    let resolved_org_id = org_id || null;
    if (org_name) {
      const fromName = await getOrgIdByName(org_name);
      resolved_org_id = fromName || null;
    }
    if (!resolved_org_id) resolved_org_id = existing.org_id ?? null;

    // Resolve the team AT the user's final location (teams are location-specific),
    // so a manager's team_id matches tickets routed to that team at that location.
    const finalTeamId = (await getTeamIdAtLocation(team_name, location_id)) || team.team_id;

    // STEP 6 — Build query
    let query, values;
    const returningClause = `
      RETURNING register_id, employee_id, first_name, last_name,
                mobile_number, email_id, org_id, location_id, wing_id
    `;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = `
        UPDATE T_USER
        SET first_name    = $1, last_name     = $2,
            mobile_number = $3, email_id      = $4,
            password_hash = $5, team_id       = $6,
            location_id   = $7, wing_id       = $8,
            org_id        = $9, role          = COALESCE($10, role),
            updated_at    = CURRENT_TIMESTAMP
        WHERE register_id = $11
        ${returningClause}
      `;
      values = [
        first_name, last_name, mobile_number, email_id,
        hashedPassword, finalTeamId, location_id, wing_id,
        resolved_org_id, (role ? role.toLowerCase() : null), id,
      ];
    } else {
      query = `
        UPDATE T_USER
        SET first_name    = $1, last_name     = $2,
            mobile_number = $3, email_id      = $4,
            team_id       = $5, location_id   = $6,
            wing_id       = $7, org_id        = $8,
            role          = COALESCE($9, role),
            updated_at    = CURRENT_TIMESTAMP
        WHERE register_id = $10
        ${returningClause}
      `;
      values = [
        first_name, last_name, mobile_number, email_id,
        finalTeamId, location_id, wing_id, resolved_org_id,
        (role ? role.toLowerCase() : null), id,
      ];
    }

    console.log('🚀 DB values:', values);
    const result = await db.query(query, values);
    const saved  = result.rows[0];
    console.log('💾 DB SAVED:', saved);

    if (!saved) return null;

    return {
      ...saved,
      team_name,
      location_name: location_name || null,
      wing_name:     wing_name     || null,
      wing_id:       saved.wing_id,
      location_id:   saved.location_id,
      org_id:        resolved_org_id,
    };

  } catch (err) {
    console.error('❌ updateUser ERROR:', err.message);
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

// ==================== ROLE & LOCATION (transfer) ====================

// Admin promotes/sets a user's role (admin | manager | employee | user).
const setUserRole = async (userId, role) => {
  const { rows } = await db.query(
    `UPDATE T_USER SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE register_id = $2
     RETURNING register_id, role`,
    [role, userId]
  );
  return rows[0] || null;
};

// Transfer a user to a new location and record the change in history.
// Old tickets keep their original location_id (we never touch t_tickets here),
// satisfying README §8.
const changeUserLocation = async (userId, newLocationId, changedBy = null) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query(
      `SELECT location_id FROM T_USER WHERE register_id = $1`, [userId]
    );
    if (!cur.rows.length) throw new Error('User not found');
    const oldLocationId = cur.rows[0].location_id;

    await client.query(
      `UPDATE T_USER SET location_id = $1 WHERE register_id = $2`,
      [newLocationId, userId]
    );
    await client.query(
      `INSERT INTO t_user_location_history
         (user_id, old_location_id, new_location_id, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [userId, oldLocationId, newLocationId, changedBy]
    );
    await client.query('COMMIT');
    return { userId, oldLocationId, newLocationId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Employees in a given team + location — used to populate a Manager's
// "assign to" dropdown (Manager can only assign within their team+location).
const getAssignableUsers = async (teamId, locationId) => {
  const { rows } = await db.query(
    `SELECT ${USER_SELECT}
     FROM T_USER r ${USER_JOINS}
     WHERE r.team_id = $1 AND r.location_id = $2
       AND r.role IN ('employee', 'manager')
     ORDER BY r.first_name`,
    [teamId, locationId]
  );
  return rows;
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
  setUserRole,
  changeUserLocation,
  getAssignableUsers,
};