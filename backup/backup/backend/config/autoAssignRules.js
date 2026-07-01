
module.exports = [
  {
    label: 'Airoli Hansa Direct — IT Services',
    locationId: 3, // our t_locations id (ticket.location_id) — Mumbai Airoli
    orgId: 2, // our t_organization id (ticket.org_id) — Hansa Direct
    // The team is resolved at runtime from name + locationId, because t_teams.team_id
    // is a SERIAL that differs by environment (IT Services @ Airoli = 24 in prod,
    // 10 in a fresh seed). Set appTeamId here only to force a specific id (overrides).
    appTeamName: 'IT Services',
    appTeamId: null,
    rosterTeamId: 2, // shift-system teamId to query
    rosterOrgId: 2, // shift-system orgId to query
  },
  {
    label: 'Airoli Hansa Direct — DBA',
    locationId: 3, // our t_locations id (ticket.location_id) — Mumbai Airoli
    orgId: 2, // our t_organization id (ticket.org_id) — Hansa Direct
    // The team is resolved at runtime from name + locationId, because t_teams.team_id
    // is a SERIAL that differs by environment (DBA @ Airoli = 28 in prod,
    // 10 in a fresh seed). Set appTeamId here only to force a specific id (overrides).
    appTeamName: 'DBA',
    appTeamId: null,
    rosterTeamId: 2, // shift-system teamId to query
    rosterOrgId: 2, // shift-system orgId to query
  },
  
];
