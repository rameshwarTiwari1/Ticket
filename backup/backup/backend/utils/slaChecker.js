// =============================================================================
// SLA breach detection (README §9). Marks tickets whose sla_due_at has passed
// (and that are still open) as breached, then notifies the assignee and the
// Manager of that ticket's team+location.
//
// Invoked on an interval from Server.js and exposed via an admin endpoint.
// =============================================================================

const db = require('../config/db');
const { createNotification } = require('./notification');
const { sendMail } = require('./mailer');

const transporterKeyForOrg = (orgName) =>
  (orgName || '').toLowerCase().includes('hansa cequity') ? 'hc' : 'hd';

const checkSlaBreaches = async () => {
  const { rows } = await db.query(`
    SELECT t.ticket_id, t.ticket_number, t.subject, t.assigned_to,
           t.assigned_team_id, t.location_id, t.org_id,
           o.org_name,
           u.email_id AS assignee_email
    FROM t_tickets t
    LEFT JOIN t_user        u ON u.register_id = t.assigned_to
    LEFT JOIN t_organization o ON o.org_id     = t.org_id
    LEFT JOIN ticket_status s ON s.status_id   = t.status_id
    WHERE t.sla_due_at IS NOT NULL
      AND t.sla_due_at < NOW()
      AND t.sla_breached = FALSE
      AND LOWER(COALESCE(s.status_name, '')) NOT IN ('resolved', 'closed', 'rejected')
  `);

  for (const t of rows) {
    await db.query(
      `UPDATE t_tickets SET sla_breached = TRUE, sla_breach_notified = TRUE WHERE ticket_id = $1`,
      [t.ticket_id]
    );

    // Notify the assignee.
    if (t.assigned_to) {
      await createNotification(t.assigned_to, t.ticket_id,
        `SLA breached for ticket ${t.ticket_number}`);
    }

    // Find and notify the Manager of this ticket's team + location.
    let managerEmail = null;
    if (t.assigned_team_id && t.location_id) {
      const mgr = await db.query(
        `SELECT register_id, email_id FROM t_user
         WHERE team_id = $1 AND location_id = $2 AND role = 'manager' LIMIT 1`,
        [t.assigned_team_id, t.location_id]
      );
      if (mgr.rows[0]) {
        managerEmail = mgr.rows[0].email_id;
        await createNotification(mgr.rows[0].register_id, t.ticket_id,
          `SLA breached for team ticket ${t.ticket_number}`);
      }
    }

    const recipients = [t.assignee_email, managerEmail].filter(Boolean);
    if (recipients.length) {
      const html = `
        <div style="font-family:sans-serif;font-size:14px;">
          <h3 style="color:#dc2626;">⚠️ SLA Breached</h3>
          <p>Ticket <b>${t.ticket_number}</b> — ${t.subject} has passed its SLA due time
             and is still open. Please act immediately.</p>
        </div>`;
      await sendMail(
        recipients.join(','),
        `SLA Breached: ${t.ticket_number} | ${t.subject}`,
        html, [], null, transporterKeyForOrg(t.org_name)
      );
    }
  }
  return rows.length;
};

// Auto-close tickets that have stayed Resolved without requester response for
// AUTO_CLOSE_DAYS days (README §4, default 3). Returns the number closed.
const autoCloseResolvedTickets = async () => {
  const days = Number(process.env.AUTO_CLOSE_DAYS) || 3;
  const { rowCount } = await db.query(`
    UPDATE t_tickets
    SET status_id = (SELECT status_id FROM ticket_status
                     WHERE LOWER(TRIM(status_name)) = 'closed' LIMIT 1),
        closed_at = NOW(),
        updated_at = NOW()
    WHERE resolved_at IS NOT NULL
      AND resolved_at < NOW() - ($1 * INTERVAL '1 day')
      AND status_id = (SELECT status_id FROM ticket_status
                       WHERE LOWER(TRIM(status_name)) = 'resolved' LIMIT 1)
  `, [days]);
  return rowCount || 0;
};

module.exports = { checkSlaBreaches, autoCloseResolvedTickets };
