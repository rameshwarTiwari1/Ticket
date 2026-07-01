// =============================================================================
// Standard recipient set for ticket-event notifications (spec Task 2.1).
//
// For any ticket event the recipients are:
//   • the ticket raiser (creator)
//   • the assigned person (if any)
//   • the assigned person's team manager(s)  (role='manager' for the ticket's
//     assigned team + location + org)
//   • the organization's Admin(s)
//   • the per-org/team mailbox from mailer.getTeamEmailConfig()
//   • any additional CC addresses stored on the ticket (additional_email)
//
// Returns { to: string[], transporterKey, from } ready for mailer.sendMail.
// De-duplicated, case-insensitive. Never throws — returns whatever it resolved.
// =============================================================================

const db = require('../config/db');
const { getTeamEmailConfig } = require('./mailer');

const addEmails = (set, val) => {
  if (!val) return;
  String(val).split(',').map((s) => s.trim()).filter(Boolean)
    .forEach((e) => set.add(e.toLowerCase()));
};

async function buildTicketRecipients(ticket) {
  const set = new Set();
  try {
    // ── raiser ────────────────────────────────────────────────────────────────
    if (ticket.creator_email) addEmails(set, ticket.creator_email);
    else if (ticket.created_by_id) {
      const r = await db.query(`SELECT email_id FROM t_user WHERE register_id = $1`, [ticket.created_by_id]);
      addEmails(set, r.rows[0]?.email_id);
    }

    // ── assigned person ─────────────────────────────────────────────────────────
    if (ticket.assigned_to_id) {
      const r = await db.query(`SELECT email_id FROM t_user WHERE register_id = $1`, [ticket.assigned_to_id]);
      addEmails(set, r.rows[0]?.email_id);
    }

    // ── assignee's team manager(s) ───────────────────────────────────────────────
    if (ticket.assigned_team_id && ticket.location_id) {
      const mgr = await db.query(
        `SELECT email_id FROM t_user
          WHERE LOWER(TRIM(role)) = 'manager' AND team_id = $1 AND location_id = $2
            AND ($3::int IS NULL OR org_id = $3) AND email_id IS NOT NULL`,
        [ticket.assigned_team_id, ticket.location_id, ticket.org_id || null]
      );
      mgr.rows.forEach((x) => addEmails(set, x.email_id));
    }

    // ── organization Admin(s) ────────────────────────────────────────────────────
    if (ticket.org_id) {
      const adm = await db.query(
        `SELECT email_id FROM t_user
          WHERE LOWER(TRIM(role)) = 'admin' AND org_id = $1 AND email_id IS NOT NULL`,
        [ticket.org_id]
      );
      adm.rows.forEach((x) => addEmails(set, x.email_id));
    }

    // ── additional CC addresses on the ticket ────────────────────────────────────
    addEmails(set, ticket.additional_email);
  } catch (err) {
    console.error('buildTicketRecipients error:', err.message);
  }

  // ── per-org/team mailbox + transporter/from resolution ──────────────────────────
  const cfg = getTeamEmailConfig(ticket.org_name, ticket.team_name);
  if (cfg?.to) cfg.to.forEach((e) => addEmails(set, e));

  const isCequity = String(ticket.org_name || '').toLowerCase().includes('hansa cequity');
  return {
    to: Array.from(set),
    transporterKey: cfg?.transporter || (isCequity ? 'hc' : 'hd'),
    from: cfg?.from || (isCequity ? process.env.SMTP_USER_HC : process.env.SMTP_USER_HD),
  };
}

module.exports = { buildTicketRecipients };
