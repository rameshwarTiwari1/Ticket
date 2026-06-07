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

  // MANAGER: tickets at THEIR location AND THEIR team only (never other locations).
  // Org-switch is view-only and does not widen beyond their own location/team,
  // so we ignore opts.org_id widening for managers.
  if (isManager(user)) {
    const loc  = next(user.location_id);
    const team = next(user.team_id);
    return {
      clause: `t.location_id = ${loc} AND t.assigned_team_id = ${team}`,
      values,
    };
  }

  // EMPLOYEE: only tickets assigned to them.
  if (isEmployee(user)) {
    const uid = next(user.userId);
    return { clause: `t.assigned_to = ${uid}`, values };
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
function canViewTicket(user, ticket) {
  if (!ticket) return false;
  if (isAdmin(user)) return true;
  if (isManager(user)) {
    return Number(ticket.location_id) === Number(user.location_id)
        && Number(ticket.assigned_team_id) === Number(user.team_id);
  }
  if (isEmployee(user)) return Number(ticket.assigned_to_id ?? ticket.assigned_to) === Number(user.userId);
  return Number(ticket.created_by_id ?? ticket.created_by) === Number(user.userId);
}

/** Whether `user` may ASSIGN/REASSIGN this ticket. */
function canAssignTicket(user, ticket) {
  if (isAdmin(user)) return true;
  if (isManager(user)) {
    return Number(ticket.location_id) === Number(user.location_id)
        && Number(ticket.assigned_team_id) === Number(user.team_id);
  }
  return false; // employees & users never reassign
}

/** Whether `user` may EDIT ticket details (not just status). */
function canEditTicket(user, ticket) {
  return canAssignTicket(user, ticket);
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
  canViewTicket, canAssignTicket, canEditTicket, canWorkTicket,
};
