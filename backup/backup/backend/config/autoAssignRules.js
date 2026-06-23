// =============================================================================
// Shift-based auto-assignment rules.
//
// Each rule says: "for tickets at THIS app location/org/team, query the external
// shift roster with THESE shift-system ids, and auto-assign to whoever is on
// shift." The roster (rosterTeamId/rosterOrgId) lives in the shift system's OWN
// id space — it is NOT this app's team_id/org_id (verified: app team 24 ⇒ roster
// team 2). Roster names are matched back to t_user BY NAME (org-scoped), so the
// app team_id/location_id of the matched user is intentionally NOT required.
//
// Only Airoli / Hansa Direct IT is enabled. To extend to another desk later,
// add another rule object here and restart. See
// docs/superpowers/specs/2026-06-23-airoli-shift-auto-assign-design.md.
// =============================================================================

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
];
