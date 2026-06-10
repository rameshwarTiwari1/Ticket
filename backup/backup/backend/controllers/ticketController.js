const Ticket = require('../models/ticketModel');
const db     = require('../config/db');
const {
  sendTicketCreatedMail,
  sendApprovalDecisionMail,
  sendTicketAssignedMail,
} = require('../utils/mailer');
const { createNotification } = require('../utils/notification');
const access = require('../utils/access');
const { canTransition, STATUS } = require('../constants/roles');
const { checkSlaBreaches } = require('../utils/slaChecker');
const activity = require('../utils/activityLog');

// ─── SLA CHECK (Admin) — also runs automatically on an interval ───────────────
exports.runSlaCheck = async (req, res) => {
  try {
    const count = await checkSlaBreaches();
    res.status(200).json({ message: `SLA check complete`, breached: count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── IT SERVICE TEAM EMAILS by org ───────────────────────────────────────────
// Must match keys in mailer.js teamEmails table (lowercase)
const IT_TEAM_EMAILS_BY_ORG = {
  'hansa cequity': ['servicedesk@hansacequity.com'],
  'hansa direct':  ['helpdesk@hansadirect.com'],
  'autosense':     ['itchennai@autosenseindia.com'],
};

const getItTeamEmails = (orgName) => {
  const key = (orgName || '').toLowerCase().trim();
  return IT_TEAM_EMAILS_BY_ORG[key] || [];
};

// ─── CREATE ───────────────────────────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const attachmentPath = req.file ? req.file.path : null;
    // Trust the authenticated user as the creator (avoids duplicate-name lookups
    // and guarantees the ticket's location is the real creator's). README §5.
    const ticketData     = { ...req.body, attachment: attachmentPath, created_by_id: req.user?.userId };

    // ── Save ticket ───────────────────────────────────────────────────────────
    const ticket = await Ticket.createTicket(ticketData);

    // ── Fetch creator email from DB ───────────────────────────────────────────
    let creatorEmail = null;
    if (ticket.created_by) {
      const row = await db.query(
        `SELECT email_id FROM T_USER WHERE register_id = $1`,
        [ticket.created_by]
      );
      creatorEmail = row.rows[0]?.email_id || null;
    }

    // ── Pass org_name EXPLICITLY from req.body ────────────────────────────────
    // ticket.org_name may be undefined after INSERT RETURNING * (no JOINs).
    // req.body.org_name always has the value the Angular frontend sent.
    const orgName = req.body.org_name || '';

    await sendTicketCreatedMail(ticket, creatorEmail, orgName);

    activity.logReq(req, 'TICKET_CREATED', {
      ticket_id: ticket.ticket_id,
      description: `Created ticket ${ticket.ticket_number} — ${ticket.subject}`,
    });

    res.status(201).json({ message: 'Ticket created successfully', ticket });
  } catch (error) {
    console.error('CREATE TICKET ERROR:', error.message);
    // Validation errors (no team mapping, missing fields) carry a 400 status +
    // code so the UI can show a professional message instead of a generic 500.
    res.status(error.status || 500).json({ message: error.message, code: error.code || 'SERVER_ERROR' });
  }
};

// ─── APPROVAL HANDLER ─────────────────────────────────────────────────────────
// GET /api/tickets-generate/approve/:token?action=approved|not_approved
// No auth required — called directly from email button click
exports.handleApproval = async (req, res) => {
  const { token }  = req.params;
  const { action } = req.query;

  if (!['approved', 'not_approved'].includes(action)) {
    return res.status(400).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
        <h2 style="color:#dc2626;">Invalid Action</h2>
        <p>The link you followed is not valid.</p>
      </body></html>
    `);
  }

  try {
    // 1. Find ticket by token — uses SELECT with JOINs so org_name IS available
    const ticket = await Ticket.getTicketByApprovalToken(token);

    if (!ticket) {
      return res.status(404).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
          <h2 style="color:#dc2626;">Link Expired or Already Used</h2>
          <p>This approval link has already been used or is invalid.</p>
        </body></html>
      `);
    }

    // 2. Check if already decided
    if (ticket.approval_status !== 'pending') {
      const label = ticket.approval_status === 'approved' ? '✅ Approved' : '❌ Not Approved';
      return res.status(200).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
          <h2 style="color:#f59e0b;">Already Decided</h2>
          <p>This ticket was already marked as <b>${label}</b> by <b>${ticket.approved_by}</b>.</p>
        </body></html>
      `);
    }

    // 3. Approver identity = the auto-selected approver from the registry
    //    (falls back to the legacy ticket email for older rows).
    const approverEmail = ticket.approver_email || ticket.email_id || 'approver@unknown.com';

    // 4. Save decision — clears token so link cannot be reused
    await Ticket.updateApprovalStatus(token, action, approverEmail);

    // 5. Get creator email (available from SELECT JOIN as creator_email)
    const creatorEmail = ticket.creator_email || null;

    // 6. Get IT Service Team emails
    const itTeamEmails = getItTeamEmails(ticket.org_name);

    // 7. Send decision emails — pass org_name explicitly (available here from JOIN)
    await sendApprovalDecisionMail(
      ticket,
      action,
      approverEmail,
      creatorEmail,
      itTeamEmails,
      ticket.org_name   // ✅ org_name IS available here (fetched via SELECT JOIN)
    );

    // 8. Return confirmation page
    const isApproved = action === 'approved';
    const color      = isApproved ? '#16a34a' : '#dc2626';
    const icon       = isApproved ? '✅' : '❌';
    const label      = isApproved ? 'Approved' : 'Not Approved';
    const message    = isApproved
      ? 'The IT Service team has been notified and will now proceed with this ticket.'
      : 'The IT Service team and ticket owner have been notified. No further action will be taken.';

    return res.status(200).send(`
      <html>
        <head>
          <meta charset="UTF-8"/>
          <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
          <title>Ticket ${label}</title>
        </head>
        <body style="font-family:sans-serif;background:#f9fafb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
          <div style="background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);padding:48px 40px;max-width:480px;width:100%;text-align:center;">
            <div style="font-size:48px;margin-bottom:16px;">${icon}</div>
            <h2 style="color:${color};margin-bottom:8px;">Ticket ${label}</h2>
            <p style="color:#374151;margin-bottom:8px;">Ticket <b>#${ticket.ticket_number}</b> — <b>${ticket.subject}</b></p>
            <p style="color:#6b7280;font-size:14px;margin-bottom:24px;">${message}</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:24px;"/>
            <p style="color:#9ca3af;font-size:12px;">You can close this tab.</p>
          </div>
        </body>
      </html>
    `);

  } catch (err) {
    console.error('APPROVAL HANDLER ERROR:', err.message);
    return res.status(500).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
        <h2 style="color:#dc2626;">Something went wrong</h2>
        <p>${err.message}</p>
      </body></html>
    `);
  }
};

// ─── GET ALL (scoped to the caller by role + location, README §2) ─────────────
exports.getAllTickets = async (req, res) => {
  try {
    // Only Admin may org-switch via ?org_id; for everyone else the scope is
    // derived from their own identity inside the model.
    const opts = {};
    if (access.isAdmin(req.user) && req.query.org_id) {
      opts.org_id = req.query.org_id;
    }
    const tickets = await Ticket.getAllTickets(req.user, opts);
    res.status(200).json(tickets);
  } catch (error) {
    console.error('GET ALL TICKETS ERROR:', error.message);
    res.status(500).json({ message: error.message });
  }
};
exports.getTicketsByAssignedTeam = async (req, res) => {
  try {
    const { teamName } = req.params;
    const orgId = req.user?.org_id || null;  // Need to from JWT token
        console.log(`Controller → teamName: "${teamName}" | org_id from JWT: ${orgId}`);

    if (!teamName) {
      return res.status(400).json({ message: 'teamName parameter is required' });
    }
    console.log('REQ.USER:', req.user);
console.log('TEAM:', teamName);
console.log('ORGID:', orgId);

    // Non-admins are restricted to their own location (README §5).
    const locationId = access.isAdmin(req.user) ? null : (req.user?.location_id || null);
    const tickets = await Ticket.getTicketsByAssignedTeam(teamName, orgId, locationId);
    res.json(tickets);
  } catch (err) {
    console.error('GET /tickets/assigned-team error:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch team tickets' });
  }
};

// ─── GET BY ID ────────────────────────────────────────────────────────────────
exports.getById = async (req, res) => {
  try {
    const ticket = await Ticket.getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (!access.canViewTicket(req.user, ticket)) {
      return res.status(403).json({ message: 'You do not have access to this ticket' });
    }
    res.status(200).json(ticket);
  } catch (error) {
    console.error('GET TICKET BY ID ERROR:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// ─── GET BY USER (own tickets; Admin may query anyone) ────────────────────────
exports.getTicketsForUser = async (req, res) => {
  try {
    const requestedId = Number(req.params.userId);
    if (!access.isAdmin(req.user) && Number(req.user.userId) !== requestedId) {
      return res.status(403).json({ message: 'You can only view your own tickets' });
    }
    const tickets = await Ticket.getTicketsByUser(requestedId);
    res.status(200).json(tickets);
  } catch (error) {
    console.error('GET USER TICKETS ERROR:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// ─── GET BY LOCATION (scoped by role; non-admins limited to own location) ──────
exports.getTicketsByLocation = async (req, res) => {
  try {
    const locationId = Number(req.params.locationId);
    if (!access.isAdmin(req.user) && Number(req.user.location_id) !== locationId) {
      return res.status(403).json({ message: 'You can only view tickets for your own location' });
    }
    const tickets = await Ticket.getTicketsByLocation(req.user, locationId);
    res.status(200).json(tickets);
  } catch (error) {
    console.error('GET LOCATION TICKETS ERROR:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const attachmentPath = req.file ? req.file.path : null;
    const existing = await Ticket.getTicketById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Ticket not found' });

    // ── Permission + lifecycle enforcement (README §3, §4) ──────────────────────
    // The edit form re-sends EVERY field (including disabled ones via getRawValue),
    // so we only treat a field as "touched" when its value actually DIFFERS from
    // the stored ticket — otherwise unchanged values would trip permission checks.
    const normVal = (v) => (v === undefined || v === null) ? '' : String(v).trim().toLowerCase();
    const fieldChanged = (f) => req.body[f] !== undefined && normVal(req.body[f]) !== normVal(existing[f]);

    const changingStatus = fieldChanged('status_name');
    const MANAGE_FIELDS = ['subject', 'priority', 'team_name', 'type_name', 'issue_name',
                           'assigned_to_name', 'client_name', 'additional_email', 'email_id'];
    const touchingManageFields = MANAGE_FIELDS.some(fieldChanged);

    if (changingStatus) {
      // The owner (requester) may REOPEN their own resolved/closed ticket (README §4);
      // all other status changes require work permission on the ticket.
      const isOwner  = Number(existing.created_by_id) === Number(req.user.userId);
      const isReopen = (req.body.status_name || '').toLowerCase() === 'reopened';
      const allowed  = access.canWorkTicket(req.user, existing) || (isOwner && isReopen);
      if (!allowed)
        return res.status(403).json({ message: 'You are not allowed to change this ticket\'s status' });
      if (!canTransition(existing.status_name, req.body.status_name))
        return res.status(400).json({
          message: `Invalid status transition: ${existing.status_name || 'New'} → ${req.body.status_name}`,
        });
    }
    if (touchingManageFields && !access.canEditTicket(req.user, existing))
      return res.status(403).json({ message: 'You are not allowed to edit this ticket' });

    // If this edit (re)assigns to a PERSON, that person must belong to the
    // ticket's team + location + org (same rule as the assign endpoint). Team
    // strings like "IT/HELP_DESK"/"DBA" won't match a user name, so they're skipped.
    if (req.body.assigned_to_name) {
      const person = await db.query(
        `SELECT register_id FROM T_USER
         WHERE LOWER(TRIM(first_name || ' ' || last_name)) = LOWER(TRIM($1)) LIMIT 1`,
        [req.body.assigned_to_name]
      );
      if (person.rows.length) {
        const ok = await db.query(
          `SELECT 1 FROM T_USER WHERE register_id = $1 AND team_id = $2 AND location_id = $3 AND org_id = $4`,
          [person.rows[0].register_id, existing.assigned_team_id, existing.location_id, existing.org_id]
        );
        if (!ok.rows.length) {
          return res.status(400).json({
            message: "You can only assign this ticket to a member of its team, location and organization.",
            code: 'BAD_ASSIGNEE',
          });
        }
      }
    }

    // Only the ticket owner may edit the description (use the id, not a name match).
    if (req.body.description !== undefined && req.body.description !== null) {
      const ownerId = existing.created_by_id;
      if (ownerId && Number(req.user.userId) !== Number(ownerId)) {
        delete req.body.description;
      }
    }

    const updateData = { ...req.body, ...(attachmentPath && { attachment: attachmentPath }) };
    const ticket = await Ticket.updateTicket(req.params.id, updateData);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (changingStatus) {
      activity.logReq(req, 'TICKET_STATUS', {
        ticket_id: Number(req.params.id),
        old_value: existing.status_name,
        new_value: req.body.status_name,
        description: `Status: ${existing.status_name} → ${req.body.status_name}`,
      });
    }

    res.status(200).json({ message: 'Ticket updated successfully', ticket });
  } catch (error) {
    console.error('UPDATE TICKET ERROR:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// ─── SELF-ASSIGN (Employee takes an unassigned ticket of their team) ──────────
exports.selfAssign = async (req, res) => {
  try {
    const existing = await Ticket.getTicketById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Ticket not found' });
    if (!access.canSelfAssign(req.user, existing)) {
      return res.status(403).json({ message: 'You can only self-assign an unassigned ticket in your team and location' });
    }
    if (existing.approval_status !== 'approved') {
      return res.status(400).json({ message: 'This ticket must be approved before it can be picked up', code: 'NOT_APPROVED' });
    }
    const result = await Ticket.assignTicket({ ticket_id: req.params.id, assigned_to: req.user.userId });
    activity.logReq(req, 'TICKET_ASSIGNED', {
      ticket_id: Number(req.params.id),
      new_value: 'self',
      description: `Self-assigned ${existing.ticket_number}`,
    });
    res.status(200).json({ message: 'Ticket assigned to you', result });
  } catch (error) {
    console.error('SELF-ASSIGN ERROR:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// ─── RATE TICKET (owner, after resolved/closed) ───────────────────────────────
exports.rateTicket = async (req, res) => {
  try {
    const rating = Number(req.body.rating);
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5', code: 'VALIDATION' });
    }
    const existing = await Ticket.getTicketById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Ticket not found' });
    if (Number(existing.created_by_id) !== Number(req.user.userId)) {
      return res.status(403).json({ message: 'Only the ticket owner can rate this ticket' });
    }
    if (!['resolved', 'closed'].includes((existing.status_name || '').toLowerCase())) {
      return res.status(400).json({ message: 'You can rate a ticket only after it is resolved or closed', code: 'NOT_RESOLVED' });
    }
    const updated = await Ticket.rateTicket(req.params.id, rating, req.body.experience);
    res.status(200).json({ message: 'Thanks for your feedback', ...updated });
  } catch (error) {
    console.error('RATE TICKET ERROR:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// ─── DELETE — Admin, or the Manager of the ticket's team+location ─────────────
exports.remove = async (req, res) => {
  try {
    const existing = await Ticket.getTicketById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Ticket not found' });
    if (!access.canAssignTicket(req.user, existing)) {
      return res.status(403).json({ message: 'You are not allowed to delete this ticket' });
    }
    const ticket = await Ticket.deleteTicket(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    res.status(200).json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('DELETE TICKET ERROR:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// ─── ASSIGN ───────────────────────────────────────────────────────────────────
// Blocked unless ticket is approved
exports.assignTicket = async (req, res) => {
  try {
    const existing = await Ticket.getTicketById(req.body.ticket_id);
    if (!existing) return res.status(404).json({ message: 'Ticket not found' });

    // Only Admin, or the Manager of this ticket's team+location, may assign (README §3).
    if (!access.canAssignTicket(req.user, existing)) {
      return res.status(403).json({ message: 'You are not allowed to assign this ticket' });
    }

    if (existing.approval_status !== 'approved') {
      const statusMsg = existing.approval_status === 'not_approved'
        ? 'This ticket was not approved and cannot be assigned.'
        : 'This ticket is still pending approval. It can only be assigned after it is approved.';
      return res.status(403).json({ message: statusMsg, approval_status: existing.approval_status });
    }

    // The assignee MUST belong to the ticket's team + location + org — for EVERY
    // role, admin included. (Prevents e.g. a DBA ticket being assigned to an IT
    // Services employee.)
    {
      const chk = await db.query(
        `SELECT 1 FROM T_USER WHERE register_id = $1 AND team_id = $2 AND location_id = $3 AND org_id = $4`,
        [req.body.assigned_to, existing.assigned_team_id, existing.location_id, existing.org_id]
      );
      if (!chk.rows.length) {
        return res.status(400).json({
          message: "You can only assign this ticket to a member of its team, location and organization.",
          code: 'BAD_ASSIGNEE',
        });
      }
    }

    const result = await Ticket.assignTicket(req.body);

    // Notifications
await createNotification(
  req.body.assigned_to,
  req.body.ticket_id,
  'New ticket assigned to you'
);

await createNotification(
  existing.created_by_id,
  req.body.ticket_id,
  'Your ticket has been assigned'
);

    const creatorRow = await db.query(
      `SELECT email_id FROM T_USER WHERE register_id = $1`,
      [existing.created_by_id]
    );
    const creatorEmail  = creatorRow.rows[0]?.email_id || null;
    const updatedTicket = await Ticket.getTicketById(req.body.ticket_id);
    await sendTicketAssignedMail(updatedTicket, result.assignee_email, creatorEmail);

    activity.logReq(req, 'TICKET_ASSIGNED', {
      ticket_id: Number(req.body.ticket_id),
      new_value: result.assignee_name || String(req.body.assigned_to),
      description: `Assigned ${existing.ticket_number} to ${result.assignee_name || req.body.assigned_to}`,
    });

    res.status(200).json({ message: 'Ticket assigned successfully', result });
  } catch (error) {
    console.error('ASSIGN TICKET ERROR:', error.message);
    res.status(500).json({ message: error.message });
  }
};