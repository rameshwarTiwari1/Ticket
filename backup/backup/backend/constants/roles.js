// =============================================================================
// Roles, ticket statuses, and lifecycle rules — single source of truth.
// Referenced by README.md (the requirements spec). Keep in sync with it.
// =============================================================================

const ROLES = Object.freeze({
  ADMIN:     'admin',
  MANAGER:   'manager',
  TEAM_LEAD: 'team_lead',   // cross-org, single-team read access (spec Task 8)
  EMPLOYEE:  'employee',
  USER:      'user',
});

// Canonical ticket statuses (see ticket lifecycle, README §4).
const STATUS = Object.freeze({
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED:         'Approved',
  REJECTED:         'Rejected',
  OPEN:             'Open',
  IN_PROGRESS:      'In Progress',
  ON_HOLD:          'On Hold',
  RESOLVED:         'Resolved',
  CLOSED:           'Closed',
  REOPENED:         'Reopened',
});

// Allowed status transitions: from -> [allowed next states].
const TRANSITIONS = Object.freeze({
  [STATUS.PENDING_APPROVAL]: [STATUS.APPROVED, STATUS.REJECTED],
  [STATUS.APPROVED]:         [STATUS.IN_PROGRESS, STATUS.OPEN],
  [STATUS.OPEN]:             [STATUS.IN_PROGRESS, STATUS.ON_HOLD],
  [STATUS.IN_PROGRESS]:      [STATUS.ON_HOLD, STATUS.RESOLVED],
  [STATUS.ON_HOLD]:          [STATUS.IN_PROGRESS, STATUS.RESOLVED],
  [STATUS.RESOLVED]:         [STATUS.CLOSED, STATUS.REOPENED],
  [STATUS.REOPENED]:         [STATUS.IN_PROGRESS, STATUS.ON_HOLD],
  [STATUS.REJECTED]:         [],
  [STATUS.CLOSED]:           [STATUS.REOPENED],
});

const norm = (s) => (s || '').toLowerCase().trim();

// Is a transition from `current` to `next` allowed by the lifecycle?
const canTransition = (current, next) => {
  if (!current) return true; // brand-new ticket
  const allowed = TRANSITIONS[
    Object.values(STATUS).find((s) => norm(s) === norm(current)) || current
  ] || [];
  return allowed.some((s) => norm(s) === norm(next));
};

// SLA target hours per priority (README §9).
const SLA_HOURS = Object.freeze({ High: 4, Medium: 8, Low: 24 });

module.exports = { ROLES, STATUS, TRANSITIONS, canTransition, SLA_HOURS, norm };
