// =============================================================================
// Shift-ending summary email (spec Task 5.4).
//
// Every ~5 minutes (polled from Server.js) this checks the roster for each
// auto-assign rule and, for anyone whose shift ENDS within 30 minutes, emails
// them (and their team manager) a summary of what they worked today:
// in-progress / resolved-today / closed-today counts.
//
// Sent ONCE per person per shift-end via an in-memory guard (resets on restart —
// acceptable: at worst a duplicate after a redeploy). Never throws.
// =============================================================================

const db = require('../config/db');
const rules = require('../config/autoAssignRules');
const { fetchShiftEndingSoon } = require('./rosterClient');
const Ticket = require('../models/ticketModel');
const { sendMail } = require('./mailer');

const notified = new Set(); // key: `${register_id}|${dayKey}|${shiftEndTime}`

const summaryHtml = (name, s, endsInMin, shiftEndTime) => `
  <div style="font-family:sans-serif;font-size:14px;max-width:600px;">
    <h3>Your shift ends soon</h3>
    <p>Hi ${name}, your shift ends at <b>${shiftEndTime || 'soon'}</b> (in about ${endsInMin} minutes).
       Here is your summary for today:</p>
    <table style="border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 12px;border:1px solid #ddd;">In Progress (still open)</td><td style="padding:6px 12px;border:1px solid #ddd;"><b>${s.in_progress}</b></td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #ddd;">Resolved today</td><td style="padding:6px 12px;border:1px solid #ddd;"><b>${s.resolved_today}</b></td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #ddd;">Closed today</td><td style="padding:6px 12px;border:1px solid #ddd;"><b>${s.closed_today}</b></td></tr>
    </table>
    <p style="color:#666;font-size:13px;">Please hand over any in-progress work before you leave.</p>
  </div>`;

const runShiftEndNotifications = async (now = new Date()) => {
  const dayKey = now.toISOString().slice(0, 10);
  for (const rule of rules) {
    try {
      const { list, available } = await fetchShiftEndingSoon(rule, now, 30);
      if (!available || !list.length) continue;

      const appTeamId = rule.appTeamId || await Ticket.resolveTeamId(rule.appTeamName, rule.locationId);
      const managers = appTeamId ? await Ticket.getTeamManagers(appTeamId, rule.locationId, rule.orgId) : [];
      const managerEmails = managers.map((m) => m.email_id).filter(Boolean);

      // Org-based sender/transporter.
      const orgRow = await db.query(`SELECT org_name FROM T_ORGANIZATION WHERE org_id = $1`, [rule.orgId]);
      const orgName = (orgRow.rows[0]?.org_name || '').toLowerCase();
      const tKey  = orgName.includes('hansa cequity') ? 'hc' : 'hd';
      const tFrom = tKey === 'hc' ? process.env.SMTP_USER_HC : process.env.SMTP_USER_HD;

      for (const p of list) {
        const u = await Ticket.resolveUserByRosterName(p.rosterName, rule.orgId);
        if (!u || !u.email_id) continue;
        const guardKey = `${u.register_id}|${dayKey}|${p.shiftEndTime}`;
        if (notified.has(guardKey)) continue;

        const s = await Ticket.shiftSummaryForUser(u.register_id);
        const name = `${u.first_name} ${u.last_name}`;
        const to = [u.email_id, ...managerEmails].filter(Boolean).join(',');
        await sendMail(to, `Shift ending soon — your summary`, summaryHtml(name, s, p.endsInMin, p.shiftEndTime), [], tFrom, tKey);
        notified.add(guardKey);
        console.log(`shift-end: notified ${name} (#${u.register_id}) — ends in ${p.endsInMin}m`);
      }
    } catch (e) {
      console.error(`shift-end: rule "${rule.label}" failed: ${e.message}`);
    }
  }
};

module.exports = { runShiftEndNotifications };
