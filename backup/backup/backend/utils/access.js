// =============================================================================
// Central access-control & visibility logic — enforces the README rules
// server-side (the "Golden Rule": visibility = location + team + role).
//
// req.user is the decoded JWT, built at login (userController.login):
//   { userId, role, org_id, team_id, team_name, location_id }
// =============================================================================

const { ROLES, norm } = require('../constants/roles');

const isAdmin    = (u) => norm(u?.role) === ROLES.ADMIN;
const isManager  = (u) => norm(u?.role) === ROLES.MANAGER;
const isEmployee = (u) => norm(u?.role) === ROLES.EMPLOYEE;
const isUser     = (u) => norm(u?.role) === ROLES.USER;

const canManage    = (u) => isAdmin(u) || isManager(u); // assign/edit at their scope
const canAdministrate = (u) => isAdmin(u);              // users/teams/approvers CRUD

/**
 * Build a SQL WHERE fragment (and param values) that scopes a ticket list query
 * to what `user` is allowed to see, per the Golden Rule.
 *
 * @param {object} user        decoded+enriched JWT
 * @param {object} [opts]
 * @param {number} [opts.org_id]  active org override (admin/manager org-switch)
 * @param {number} [opts.startIndex] first positional param index (default 1)
 * @returns {{ clause: string, values: any[] }}  clause WITHOUT leading WHERE/AND
 */
function ticketVisibilityScope(user, opts = {}) {
  const values = [];
  let i = opts.startIndex || 1;
  const next = (v) => { values.push(v); return `$${i++}`; };

  // ADMIN: all tickets; optionally narrowed to the org they've switched to.
  if (isAdmin(user)) {
    if (opts.org_id) return { clause: `t.org_id = ${next(Number(opts.org_id))}`, values };
    return { clause: 'TRUE', values };
  }

  // MANAGER: their team's tickets (own org + location + team), PLUS any ticket
  // THEY raised themselves — even when it routes to another team (README §3:
  // "View own tickets raised by them" applies to Managers too). So an IT Services
  // manager who opens a DBA ticket still sees it in their own list, while still
  // never seeing OTHER people's DBA/other-team tickets.
  if (isManager(user)) {
    const created = next(user.userId);
    const loc  = next(user.location_id);
    const team = next(user.team_id);
    const org  = next(user.org_id);
    return {
      clause: `(t.created_by = ${created} OR ` +
              `(t.location_id = ${loc} AND t.assigned_team_id = ${team} AND t.org_id = ${org}))`,
      values,
    };
  }

  // EMPLOYEE: tickets they RAISED (created_by) or are assigned to them, PLUS the
  // unassigned pool of their own org+location+team (so they can self-assign — notes
  // Phase-1 #2). created_by is included so an employee always sees a ticket they
  // raised, even when it routes to a different team.
  if (isEmployee(user)) {
    const created = next(user.userId);
    const uid  = next(user.userId);
    const team = next(user.team_id);
    const loc  = next(user.location_id);
    const org  = next(user.org_id);
    return {
      clause: `(t.created_by = ${created} OR t.assigned_to = ${uid} OR (t.assigned_to IS NULL ` +
              `AND t.assigned_team_id = ${team} AND t.location_id = ${loc} AND t.org_id = ${org}))`,
      values,
    };
  }

  // USER (requester): only tickets they created.
  const uid = next(user.userId);
  return { clause: `t.created_by = ${uid}`, values };
}

/**
 * Whether `user` may VIEW a specific ticket row (already fetched).
 * ticket row uses the model's aliased columns (org_id, location_id,
 * assigned_team_id is exposed as team via joins — we check raw ids passed in).
 */
// Manager scope helper — same org + location + team as the ticket.
function managerOwnsTicket(user, ticket) {
  return Number(ticket.org_id) === Number(user.org_id)
      && Number(ticket.location_id) === Number(user.location_id)
      && Number(ticket.assigned_team_id) === Number(user.team_id);
}

function canViewTicket(user, ticket) {
  if (!ticket) return false;
  if (isAdmin(user)) return true;
  if (isManager(user)) return managerOwnsTicket(user, ticket)
      || Number(ticket.created_by_id ?? ticket.created_by) === Number(user.userId);
  if (isEmployee(user)) {
    // a ticket they raised is always visible to them
    if (Number(ticket.created_by_id ?? ticket.created_by) === Number(user.userId)) return true;
    const assignee = ticket.assigned_to_id ?? ticket.assigned_to;
    if (Number(assignee) === Number(user.userId)) return true;
    // unassigned pool of their own org+location+team (for self-assign)
    return !assignee
        && Number(ticket.assigned_team_id) === Number(user.team_id)
        && Number(ticket.location_id) === Number(user.location_id)
        && Number(ticket.org_id) === Number(user.org_id);
  }
  return Number(ticket.created_by_id ?? ticket.created_by) === Number(user.userId);
}

/** Whether `user` may ASSIGN/REASSIGN this ticket. */
function canAssignTicket(user, ticket) {
  if (isAdmin(user)) return true;
  if (isManager(user)) return managerOwnsTicket(user, ticket);
  return false; // employees & users never reassign (see canSelfAssign for self-assign)
}

/** Whether `user` may EDIT ticket details (not just status). */
function canEditTicket(user, ticket) {
  return canAssignTicket(user, ticket);
}

/** Whether an EMPLOYEE may self-assign an UNASSIGNED ticket of their own
 *  org + location + team (notes Phase-1 #2). */
function canSelfAssign(user, ticket) {
  if (!isEmployee(user)) return false;
  if (ticket.assigned_to_id ?? ticket.assigned_to) return false; // already taken
  return Number(ticket.org_id) === Number(user.org_id)
      && Number(ticket.location_id) === Number(user.location_id)
      && Number(ticket.assigned_team_id) === Number(user.team_id);
}

/** Whether `user` may change ticket STATUS / add work notes. */
function canWorkTicket(user, ticket) {
  if (isAdmin(user)) return true;
  if (isManager(user)) return canAssignTicket(user, ticket);
  if (isEmployee(user)) return Number(ticket.assigned_to_id ?? ticket.assigned_to) === Number(user.userId);
  return false;
}

module.exports = {
  isAdmin, isManager, isEmployee, isUser,
  canManage, canAdministrate,
  ticketVisibilityScope,
  canViewTicket, canAssignTicket, canEditTicket, canWorkTicket, canSelfAssign,
};
