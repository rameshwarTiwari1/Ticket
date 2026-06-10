const db     = require('../config/db');
const crypto = require('crypto');
const { resolveApprover, isApproverForLocation } = require('./approverModel');
const { STATUS } = require('../constants/roles');
const { ticketVisibilityScope } = require('../utils/access');

// Resolve the team that should handle a ticket (README §7), STRICTLY at the
// ticket's own location (Option B — separate team per office). We resolve the
// issue's mapped team BY NAME and require an instance of that team AT this
// location. We deliberately do NOT fall back to a team at another office —
// that would create a ticket whose location and team disagree (invisible to
// every manager). If no matching team exists at this location, return null and
// let the caller surface a clear "create the team at this office" error.
const resolveTeamForIssueAtLocation = async (issue_id, location_id, fallbackTeamName) => {
  if (!location_id) return null;

  const teamAtLocation = async (teamName) => {
    if (!teamName) return null;
    const r = await db.query(
      `SELECT team_id FROM t_teams
       WHERE LOWER(TRIM(team_name)) = LOWER(TRIM($1)) AND location_id = $2
       LIMIT 1`,
      [teamName, location_id]
    );
    return r.rows[0]?.team_id ?? null;
  };

  // 1) The ISSUE category is the source of truth for routing. Resolve its mapped
  //    team AT this location. If that team doesn't exist here, return null —
  //    do NOT fall back to the creator's own team (that mis-routes, e.g. a DBA
  //    issue landing on IT Services). The caller surfaces a clear 400.
  if (issue_id) {
    const mapped = await db.query(
      `SELECT te.team_name
       FROM t_issues i JOIN t_teams te ON te.team_id = i.mapped_team_id
       WHERE i.issue_id = $1`,
      [issue_id]
    );
    const mappedName = mapped.rows[0]?.team_name;
    if (mappedName) return await teamAtLocation(mappedName);   // null if not at this location
  }

  // 2) Only when the issue has no mapped team: fall back to an explicit team name.
  return await teamAtLocation(fallbackTeamName);
};

const generateTicketNumber = () => {
  const now = new Date();
  return `TKC${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
};

const calculateSLA = (priority) => {
  const now = new Date();
  switch (priority) {
    case 'High':   now.setHours(now.getHours() + 4);  break;
    case 'Medium': now.setHours(now.getHours() + 8);  break;
    case 'Low':    now.setDate(now.getDate() + 1);     break;
    default:       return null;
  }
  return now;
};

const getIdByName = async (table, idCol, nameCol, value) => {
  if (!value) return null;
  const res = await db.query(
    `SELECT ${idCol} FROM ${table} WHERE LOWER(${nameCol}) LIKE LOWER($1) LIMIT 1`,
    [`${value.trim()}`]
  );
  return res.rows[0]?.[idCol] ?? null;
};

const TEAM_STRINGS = ['IT/HELP_DESK', 'DBA'];
const isTeamString = (val) => TEAM_STRINGS.includes((val || '').toUpperCase().trim());

// ─── Shared SELECT used in all queries ────────────────────────────────────────
const TICKET_SELECT = `
  t.ticket_id,
  t.ticket_number,
  t.subject,
  t.email_id,
  t.created_by  AS created_by_id,
  t.assigned_to AS assigned_to_id,
  t.assigned_team_id,
  t.assigned_to_user,
  u1.first_name || ' ' || u1.last_name AS created_by_name,
  COALESCE(
    CASE
      WHEN u2.first_name IS NOT NULL
      THEN u2.first_name || ' ' || u2.last_name
      ELSE NULL
    END,
    t.assigned_to_team::text
  ) AS assigned_to_name,
  ty.type_name,
  i.issue_name,
  te.team_name,
  s.status_name,
  t.priority,
  t.description,
  t.additional_email,
  t.attachment,
  t.created_at,
  t.updated_at,
  t.resolved_at,
  t.closed_at,
  t.sla_due_at,
  c.client_name,
  t.org_id,
  t.wing_id,
  o.org_name,
  t.location_id,
  l.location_name,
  t.approval_status,
  t.approval_token,
  t.approved_by,
  t.approved_at,
  t.approval_remark,
  t.approver_email,
  t.sla_breached,
  t.status_id,
  t.rating,
  t.experience,
  t.rated_at,
  u1.email_id AS creator_email
`;

const TICKET_JOINS = `
  LEFT JOIN T_USER        u1 ON u1.register_id  = t.created_by
  LEFT JOIN T_USER        u2 ON u2.register_id  = t.assigned_to
  LEFT JOIN T_TYPES       ty ON ty.type_id       = t.type_id
  LEFT JOIN T_ISSUES      i  ON i.issue_id       = t.issue_id
  LEFT JOIN T_TEAMS       te ON te.team_id       = t.assigned_team_id
  LEFT JOIN ticket_status s  ON s.status_id      = t.status_id
  LEFT JOIN T_CLIENTS     c  ON c.client_id      = t.client_id
  LEFT JOIN T_ORGANIZATION o ON o.org_id         = t.org_id
  LEFT JOIN T_LOCATIONS   l  ON l.location_id    = t.location_id
`;

// ─── CREATE TICKET ────────────────────────────────────────────────────────────
exports.createTicket = async (data) => {
  // Add this near the top of createTicket, alongside other destructured values
console.log("Hello Print",data);
const wing_id = data.wing_id ? parseInt(data.wing_id) : null;
console.log(" wing_id received:", data.wing_id);
  const ticket_number    = generateTicketNumber();
  const sla_due_at       = calculateSLA(data.priority);
  console.log(data);
  // Generate a unique approval token for this ticket
  const approval_token   = crypto.randomUUID();

  // Prefer the authenticated creator id (set by the controller); fall back to
  // a name lookup only for legacy/direct callers.
  const created_by = data.created_by_id
    ? Number(data.created_by_id)
    : await getIdByName(
        'T_USER', 'register_id',
        "first_name || ' ' || last_name",
        data.created_by_name
      );

  const assignedToTeam = data.assigned_to_name
    ? data.assigned_to_name.toUpperCase().trim()
    : null;

  const TEAM_LIST = ['IT/HELP_DESK', 'DBA'];
  const isTeam    = TEAM_LIST.includes(assignedToTeam);

  const assigned_to = isTeam
    ? null
    : await getIdByName(
        'T_USER', 'register_id',
        "first_name || ' ' || last_name",
        data.assigned_to_name
      );

  const type_id   = await getIdByName('T_TYPES',       'type_id',   'type_name',   data.type_name);
  const issue_id  = await getIdByName('T_ISSUES',      'issue_id',  'issue_name',  data.issue_name);
  const client_id = await getIdByName('T_CLIENTS',     'client_id', 'client_name', data.client_name);

  // ── Org + Location come from the CREATOR's profile (README §5). ──────────────
  // Location is stamped from the creator's CURRENT location and is immutable.
  let org_id = null, location_id = null;
  if (created_by) {
    const creatorRow = await db.query(
      `SELECT org_id, location_id FROM T_USER WHERE register_id = $1`, [created_by]
    );
    org_id      = creatorRow.rows[0]?.org_id || null;
    location_id = creatorRow.rows[0]?.location_id || null;
  }
  // org_name may override the org (e.g. admin raising on behalf of an org).
  if (data.org_name) {
    const byName = await getIdByName('T_ORGANIZATION', 'org_id', 'org_name', data.org_name);
    if (byName) org_id = byName;
  }

  // ── Auto-route to the responsible team at this location (README §7). ─────────
  const team_id = await resolveTeamForIssueAtLocation(issue_id, location_id, data.team_name);

  // ── New tickets always start at "Pending Approval" (README §4). ─────────────
  const status_id = await getIdByName('ticket_status', 'status_id', 'status_name', STATUS.PENDING_APPROVAL);

  // ── Approver: use the one picked on the form (if it's a valid approver for
  //    this location), else auto-select from the registry by location+team (§6). ──
  let approver_email = null;
  if (data.approver_email && await isApproverForLocation(data.approver_email, location_id)) {
    approver_email = data.approver_email;
  } else {
    approver_email = await resolveApprover(location_id, team_id);
  }

  // Clear, actionable VALIDATION error (HTTP 400, not 500) when the office has no
  // team to handle this issue — tickets never route to another office's team.
  if (created_by && location_id && issue_id && !team_id) {
    const err = new Error(
      'No team is set up at your location to handle this category. ' +
      'Ask an admin to map this category to a team at your location, or choose a different category.'
    );
    err.status = 400;
    err.code = 'NO_TEAM_MAPPING';
    throw err;
  }

  const missing = [];
  if (!created_by) missing.push('created_by_name');
  if (!type_id)    missing.push('type_name');
  if (!issue_id)   missing.push('issue_name');
  if (!team_id)    missing.push('team (no team at this location for this issue)');
  if (!location_id) missing.push('location (creator has no location set)');
  if (!status_id)  missing.push("status ('Pending Approval' not seeded)");

  if (missing.length > 0) {
    const err = new Error(`Missing or invalid fields: ${missing.join(', ')}`);
    err.status = 400;
    err.code = 'VALIDATION';
    throw err;
  }
  console.log("Node Date:", new Date());
console.log("ISO:", new Date().toISOString());
console.log("Timezone:", Intl.DateTimeFormat().resolvedOptions().timeZone);

let assigned_to_user = data.assigned_to_name;
console.log("assign_to_user",assigned_to_user);


  // A person may only be PRE-ASSIGNED at creation if they belong to the ticket's
  // team + location + org; otherwise the ticket is created unassigned (it gets
  // assigned later, post-approval, via the validated assign path).
  let validatedAssignedTo = null;
  if (assigned_to && team_id && location_id) {
    const chk = await db.query(
      `SELECT 1 FROM t_user WHERE register_id = $1 AND team_id = $2 AND location_id = $3 AND org_id = $4`,
      [Number(assigned_to), team_id, location_id, org_id]
    );
    if (chk.rows.length) validatedAssignedTo = Number(assigned_to);
  }

  const { rows } = await db.query(`
    INSERT INTO T_TICKETS (
      ticket_number, created_by, assigned_to, assigned_to_user,
      subject, description,
      type_id, issue_id, assigned_team_id, status_id, priority,
      email_id, additional_email, attachment, sla_due_at,
      client_id, org_id, location_id,
      approval_status, approval_token, wing_id, approver_email
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
    RETURNING *
  `, [
    ticket_number,
    created_by,
    validatedAssignedTo,
    assigned_to_user,
    data.subject,
    data.description || null,
    type_id,
    issue_id,
    team_id,
    status_id,
    data.priority,
    data.email_id || null,
    data.additional_email || null,
    data.attachment || null,
    sla_due_at,
    client_id || null,
    org_id || null,
    location_id || null,
    'pending',      // approval_status starts as pending
    approval_token,
    wing_id,
    approver_email
  ]);

  return {
    ...rows[0],
    created_by_name:  data.created_by_name || null,
    assigned_to_name: assignedToTeam || data.assigned_to_name || null,
    issue_name:       data.issue_name  || null,
    client_name:      data.client_name || null,
  };
};

// ─── GET ALL TICKETS (scoped by role + location — the Golden Rule, README §2) ──
// `user` is the enriched JWT (req.user). `opts.org_id` lets Admin org-switch.
exports.getAllTickets = async (user, opts = {}) => {
  try {
    const { clause, values } = ticketVisibilityScope(user, {
      org_id: opts.org_id,
      startIndex: 1,
    });

    const query = `
      SELECT ${TICKET_SELECT}
      FROM T_TICKETS t
      ${TICKET_JOINS}
      WHERE ${clause}
      ORDER BY t.created_at DESC
    `;

    const { rows } = await db.query(query, values);
    return rows || [];
  } catch (error) {
    console.error("MODEL getAllTickets ERROR:", error);
    throw new Error("Database error while fetching tickets");
  }
};

// ─── GET TICKETS BY USER ──────────────────────────────────────────────────────
exports.getTicketsByUser = async (userId) => {
  const { rows } = await db.query(`
    SELECT ${TICKET_SELECT}
    FROM T_TICKETS t
    ${TICKET_JOINS}
    WHERE t.created_by = $1 OR t.assigned_to = $1
    ORDER BY t.created_at DESC
  `, [userId]);
  return rows;
};

// ─── GET TICKETS BY LOCATION (role-scoped, README §2/§5) ──────────────────────
exports.getTicketsByLocation = async (user, locationId) => {
  const { clause, values } = ticketVisibilityScope(user, { startIndex: 2 });
  const query = `
    SELECT ${TICKET_SELECT}
    FROM T_TICKETS t
    ${TICKET_JOINS}
    WHERE t.location_id = $1 AND (${clause})
    ORDER BY t.created_at DESC
  `;
  const { rows } = await db.query(query, [locationId, ...values]);
  return rows || [];
};

// ─── GET TICKET BY ID ─────────────────────────────────────────────────────────
exports.getTicketById = async (id) => {
  const { rows } = await db.query(`
    SELECT ${TICKET_SELECT}
    FROM T_TICKETS t
    ${TICKET_JOINS}
    WHERE t.ticket_id = $1
  `, [id]);
  return rows[0];
};

// ─── GET TICKET BY APPROVAL TOKEN ─────────────────────────────────────────────
exports.getTicketByApprovalToken = async (token) => {
  const { rows } = await db.query(`
    SELECT ${TICKET_SELECT}
    FROM T_TICKETS t
    ${TICKET_JOINS}
    WHERE t.approval_token = $1
  `, [token]);
  return rows[0];
};

// ─── UPDATE APPROVAL STATUS ───────────────────────────────────────────────────
exports.updateApprovalStatus = async (token, decision, approverEmail) => {
  // Advance the lifecycle status too: approved -> Approved, not_approved -> Rejected.
  const statusName = decision === 'approved' ? STATUS.APPROVED : STATUS.REJECTED;
  const statusRow = await db.query(
    `SELECT status_id FROM ticket_status WHERE LOWER(TRIM(status_name)) = LOWER(TRIM($1)) LIMIT 1`,
    [statusName]
  );
  const status_id = statusRow.rows[0]?.status_id || null;

  const { rows } = await db.query(`
    UPDATE T_TICKETS
    SET
      approval_status = $1,
      approved_by     = $2,
      approved_at     = CURRENT_TIMESTAMP,
      approval_token  = NULL,
      status_id       = COALESCE($3, status_id),
      updated_at      = CURRENT_TIMESTAMP
    WHERE approval_token = $4
    RETURNING *
  `, [decision, approverEmail, status_id, token]);
  return rows[0];
};

// ─── UPDATE TICKET ────────────────────────────────────────────────────────────
exports.updateTicket = async (id, data) => {
  const newAssignedToTeam = data.assigned_to_name && isTeamString(data.assigned_to_name)
    ? data.assigned_to_name.toUpperCase().trim()
    : null;

  const assigned_to = data.assigned_to_name && !newAssignedToTeam
    ? await getIdByName(
        'T_USER', 'register_id',
        "first_name || ' ' || last_name",
        data.assigned_to_name
      )
    : null;

  const type_id   = data.type_name   ? await getIdByName('T_TYPES',       'type_id',   'type_name',   data.type_name)   : null;
  const issue_id  = data.issue_name  ? await getIdByName('T_ISSUES',      'issue_id',  'issue_name',  data.issue_name)  : null;
  const team_id   = data.team_name   ? await getIdByName('T_TEAMS',       'team_id',   'team_name',   data.team_name)   : null;
  const status_id = data.status_name ? await getIdByName('ticket_status', 'status_id', 'status_name', data.status_name) : null;
  const client_id = data.client_name ? await getIdByName('T_CLIENTS',     'client_id', 'client_name', data.client_name) : null;

  let resolved_at = null;
  let closed_at   = null;

  if (data.status_name) {
    if (data.status_name.toLowerCase() === 'resolved') resolved_at = new Date();
    if (data.status_name.toLowerCase() === 'closed')   closed_at   = new Date();
  }

  const query = `
    UPDATE T_TICKETS SET
      subject          = COALESCE($1,  subject),
      priority         = COALESCE($2,  priority),
      description      = COALESCE($3,  description),
      assigned_to      = COALESCE($4::int, assigned_to),
      assigned_team_id = COALESCE($5,  assigned_team_id),
      type_id          = COALESCE($6,  type_id),
      issue_id         = COALESCE($7,  issue_id),
      status_id        = COALESCE($8,  status_id),
      email_id         = COALESCE($9,  email_id),
      additional_email = COALESCE($10, additional_email),
      attachment       = COALESCE($11, attachment),
      updated_at       = CURRENT_TIMESTAMP,
      resolved_at      = COALESCE($12, resolved_at),
      closed_at        = COALESCE($13, closed_at),
      client_id        = COALESCE($14, client_id)
     
    WHERE ticket_id = $15 
    RETURNING *
  `;
// wing_id          = COALESCE($15, wing_id),
  const values = [
    data.subject       || null,
    data.priority      || null,
    data.description   || null,
    assigned_to        || null,
    team_id            || null,
    type_id            || null,
    issue_id           || null,
    status_id          || null,
    data.email_id      || null,
    data.additional_email || null,
    data.attachment    || null,
    resolved_at,
    closed_at,
    client_id          || null,
    //  wing_id          || null,  
    id
  ];

  const { rows } = await db.query(query, values);
  return rows[0];
};

// ─── RATE TICKET (requester feedback; visible to manager/admin) ───────────────
exports.rateTicket = async (id, rating, experience) => {
  const { rows } = await db.query(
    `UPDATE T_TICKETS
     SET rating = $1, experience = $2, rated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE ticket_id = $3
     RETURNING ticket_id, rating, experience, rated_at`,
    [rating, experience || null, id]
  );
  return rows[0];
};

// ─── DELETE TICKET ────────────────────────────────────────────────────────────
exports.deleteTicket = async (id) => {
  const res = await db.query(
    `DELETE FROM T_TICKETS WHERE ticket_id = $1 RETURNING *`, [id]
  );
  return res.rows[0];
};

// ─── ASSIGN TICKET ───────────────────────────────────────────────────────────
exports.assignTicket = async (data) => {
  // org_id/location_id are stamped at creation and are IMMUTABLE — never updated here.
  const { ticket_id, assigned_to, estimated_end_date, remark } = data;

  const assigneeRow = await db.query(
    `SELECT register_id, first_name, last_name, email_id FROM T_USER WHERE register_id = $1`,
    [assigned_to]
  );
  const assignee = assigneeRow.rows[0];
  if (!assignee) throw new Error('Assigned user not found');

  const status_id = await getIdByName('ticket_status', 'status_id', 'status_name', 'In Progress');

  const { rows } = await db.query(`
    UPDATE T_TICKETS SET
      assigned_to        = $1,
      status_id          = COALESCE($2, status_id),
      estimated_end_date = $3,
      remark             = $4,
      updated_at         = CURRENT_TIMESTAMP
    WHERE ticket_id = $5
    RETURNING *
  `, [
    assigned_to,
    status_id || null,
    estimated_end_date || null,
    remark || null,
    ticket_id,
  ]);

  if (!rows[0]) throw new Error('Ticket not found');

  return {
    ...rows[0],
    assignee_name:  `${assignee.first_name} ${assignee.last_name}`,
    assignee_email: assignee.email_id,
  };
};

// Team-scoped list. When `locationId` is provided (non-admin callers), results
// are further restricted to that location so a team at Location B never sees
// Location A's tickets for the same team name (README §5).
const getTicketsByAssignedTeam = async (teamName, orgId, locationId = null) => {
  // Resolve the team at the caller's location when we have one, otherwise by name.
  let teamId;
  if (locationId) {
    const r = await db.query(
      `SELECT team_id FROM T_TEAMS
       WHERE LOWER(team_name) = LOWER($1) AND location_id = $2 LIMIT 1`,
      [teamName, locationId]
    );
    teamId = r.rows[0]?.team_id;
  }
  if (!teamId) {
    const r = await db.query(
      `SELECT team_id FROM T_TEAMS WHERE LOWER(team_name) = LOWER($1) LIMIT 1`,
      [teamName]
    );
    teamId = r.rows[0]?.team_id;
  }
  if (!teamId) return [];

  const values = [teamId];
  let where = `WHERE t.assigned_team_id = $1`;
  if (orgId)      { values.push(orgId);      where += ` AND t.org_id = $${values.length}`; }
  if (locationId) { values.push(locationId); where += ` AND t.location_id = $${values.length}`; }

  const query = `
    SELECT ${TICKET_SELECT}
    FROM T_TICKETS t
    ${TICKET_JOINS}
    ${where}
    ORDER BY t.created_at DESC
  `;
  const { rows } = await db.query(query, values);
  return rows;
};

exports.getTicketsByAssignedTeam = getTicketsByAssignedTeam;

