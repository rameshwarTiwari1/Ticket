// =============================================================================
// Shift-based auto-assignment job (Airoli / Hansa Direct IT only).
//
// Polled every minute from Server.js. For each rule in config/autoAssignRules.js:
//   1. ask the roster who is on shift right now,
//   2. map those roster names to t_user rows (by name, org-scoped),
//   3. assign approved+unassigned tickets to the least-loaded on-shift person,
//   4. reassign In-Progress tickets whose roster-managed assignee has gone off
//      shift to someone currently on shift.
//
// Trusts the roster as the source of truth: it does NOT enforce the manual
// path's team+location membership check. Designed to never throw fatally — any
// per-ticket or per-rule error is logged and the loop continues. See
// docs/superpowers/specs/2026-06-23-airoli-shift-auto-assign-design.md.
// =============================================================================

const db = require('../config/db');
const rules = require('../config/autoAssignRules');
const { fetchOnShiftUsers } = require('./rosterClient');
const Ticket = require('../models/ticketModel');
const { createNotification } = require('./notification');
const { sendTicketAssignedMail } = require('./mailer');

const norm = (s) => String(s || '').trim().toLowerCase();

// Map on-shift roster people → t_user rows. Unmatched / ambiguous names are
// dropped with a log (we can't safely assign to an unknown register_id).
const resolveCandidates = async (onShift, orgId) => {
  // console.log("Orginazation ID",orgId);
  const out = [];
  for (const p of onShift) {
    const u = await Ticket.resolveUserByRosterName(p.rosterName, orgId);
    if (!u) {
      console.warn(`auto-assign: no unique t_user for roster name "${p.rosterName}" (org ${orgId}) — skipped`);
      continue;
    }
    out.push({
      registerId: u.register_id,
      email: u.email_id,
      name: `${u.first_name} ${u.last_name}`,
      rosterName: p.rosterName,
    });
  }
  return out;
};

// Least open In-Progress tickets wins; tie-break on lowest register_id. `load`
// is a mutable map updated as we assign within a tick, so work spreads instead
// of piling onto one idle person.
const pickLeastLoaded = (candidates, load, excludeId) => {
  let best = null;
  for (const c of candidates) {
    if (excludeId && c.registerId === excludeId) continue;
    const l = load[c.registerId] || 0;
    if (
      best === null ||
      l < best.load ||
      (l === best.load && c.registerId < best.cand.registerId)
    ) {
      best = { cand: c, load: l };
    }
  }
  return best ? best.cand : null;
};

const notifyAssignment = async (ticketId, assignee, creatorId, kind) => {
  await createNotification(
    assignee.registerId,
    ticketId,
    kind === 'reassign' ? 'A ticket was reassigned to you' : 'New ticket auto-assigned to you'
  );
  if (creatorId) await createNotification(creatorId, ticketId, 'Your ticket has been assigned');
  try {
    let creatorEmail = null;
    if (creatorId) {
      const r = await db.query(`SELECT email_id FROM T_USER WHERE register_id = $1`, [creatorId]);
      creatorEmail = r.rows[0]?.email_id || null;
    }
    const full = await Ticket.getTicketById(ticketId);
    if (full) await sendTicketAssignedMail(full, assignee.email, creatorEmail);
  } catch (e) {
    console.error(`auto-assign: notification email failed for ticket ${ticketId}: ${e.message}`);
  }
};

const runRule = async (baseRule, now) => {
  // Resolve our app team_id from name + location (portable across environments),
  // unless the rule pins an explicit appTeamId.
  const appTeamId = baseRule.appTeamId || (await Ticket.resolveTeamId(baseRule.appTeamName, baseRule.locationId));
  if (!appTeamId) {
    console.warn(`auto-assign: rule "${baseRule.label}" — no team "${baseRule.appTeamName}" at location ${baseRule.locationId}; skipped`);
    return;
  }
  const rule = { ...baseRule, appTeamId };

  const { onShift, known, available } = await fetchOnShiftUsers(rule, now);
  if (!available) return; // roster call failed — make NO changes this tick
  if (onShift.length === 0) return; // nobody on shift → wait & retry next tick

  const candidates = await resolveCandidates(onShift, rule.orgId);
  if (candidates.length === 0) return; // on-shift people exist but none resolved

  const candIds = candidates.map((c) => c.registerId);
  const onShiftIds = new Set(candIds);
  const load = await Ticket.countOpenByAssignee(candIds); // mutable working copy

  // 1) Fresh assignments: approved + unassigned.
  const fresh = await Ticket.getAutoAssignableTickets(rule);
  for (const t of fresh) {
    const pick = pickLeastLoaded(candidates, load, null);
    if (!pick) break;
    try {
      await Ticket.autoAssignTicket(t.ticket_id, pick.registerId, 'Auto-assigned by shift roster');
      load[pick.registerId] = (load[pick.registerId] || 0) + 1;
      await notifyAssignment(t.ticket_id, pick, t.created_by, 'assign');
      console.log(`auto-assign: ${t.ticket_number} → ${pick.name} (#${pick.registerId})`);
    } catch (e) {
      console.error(`auto-assign: failed for ${t.ticket_number}: ${e.message}`);
    }
  }

  // 2) Reassignment: In-Progress tickets whose roster-managed assignee is now off shift.
  const inProgress = await Ticket.getReassignableTickets(rule);
  const assigneeIds = [...new Set(inProgress.map((t) => t.assigned_to).filter(Boolean))];
  const nameById = {};
  if (assigneeIds.length) {
    const { rows } = await db.query(
      `SELECT register_id, first_name, last_name FROM T_USER WHERE register_id = ANY($1::int[])`,
      [assigneeIds]
    );
    for (const r of rows) nameById[r.register_id] = norm(`${r.first_name} ${r.last_name}`);
  }
  const knownSet = new Set(known);
  for (const t of inProgress) {
    if (onShiftIds.has(t.assigned_to)) continue; // still on shift → leave it
    const assigneeName = nameById[t.assigned_to];
    if (!assigneeName || !knownSet.has(assigneeName)) continue; // not roster-managed (e.g. manual) → leave
    const pick = pickLeastLoaded(candidates, load, t.assigned_to);
    if (!pick) continue;
    try {
      await Ticket.autoAssignTicket(t.ticket_id, pick.registerId, 'Reassigned: previous assignee off shift');
      load[pick.registerId] = (load[pick.registerId] || 0) + 1;
      await notifyAssignment(t.ticket_id, pick, t.created_by, 'reassign');
      console.log(`auto-reassign: ${t.ticket_number} → ${pick.name} (#${pick.registerId})`);
    } catch (e) {
      console.error(`auto-reassign: failed for ${t.ticket_number}: ${e.message}`);
    }
  }
};

// Run all rules. Returns nothing; logs progress. Never throws.
const runAutoAssign = async (now = new Date()) => {
  for (const rule of rules) {
    try {
      await runRule(rule, now);
    } catch (e) {
      console.error(`auto-assign: rule "${rule.label}" failed: ${e.message}`);
    }
  }
};

module.exports = { runAutoAssign };
