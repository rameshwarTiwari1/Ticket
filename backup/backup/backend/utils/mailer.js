const emailer = require("nodemailer");
const logger  = require("./logger");

// ─── TWO TRANSPORTERS — one per SMTP account ─────────────────────────────────
const transporterHC = emailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT),
  secure: false,
  auth:   { user: process.env.SMTP_USER_HC, pass: process.env.SMTP_PASS_HC },
  tls:    { rejectUnauthorized: false },
});

const transporterHD = emailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT),
  secure: false,
  auth:   { user: process.env.SMTP_USER_HD, pass: process.env.SMTP_PASS_HD },
  tls:    { rejectUnauthorized: false },
});

// ─── ORG-AWARE ROUTING TABLE ──────────────────────────────────────────────────
//servicedesk@hansacequity.com
//dbasupport@hansacequity.com"
// const teamEmails = {
//   "hansa cequity": {
//     "IT/HELP_DESK": { from: process.env.SMTP_USER_HC, to: ["suraj.jogale@hansacequity.com"], transporter: "hc" },
//     "DBA":          { from: process.env.SMTP_USER_HC, to: ["suraj.jogale@hansacequity.com"],  transporter: "hc" },
//   },
//   //abhishek.sharma@hansadirect.com
//   "hansa direct": {
//     "CRM":          { from: process.env.SMTP_USER_HD, to: ["crm@hansadirect.com"],                                                                               transporter: "hd" },
//     "MIS":          { from: process.env.SMTP_USER_HD, to: ["suraj.jogale@hansacequity.com", "ashish.jadhav@hansadirect.com", "dakshata.dalavi@hansadirect.com"], transporter: "hd" },
//     "IT/HELP_DESK": { from: process.env.SMTP_USER_HD, to: ["suraj.jogale@hansacequity.com"],                                                                          transporter: "hd" },
//   },//helpdesk@hansadirect.com
//   "autosense": {
//     "IT/HELP_DESK": { from: process.env.SMTP_USER_HD, to: ["itchennai@autosenseindia.com"], transporter: "hd" },
//   },
// };
// const teamEmails = {
//   "hansa cequity": {
//     "IT/HELP_DESK": { from: process.env.SMTP_USER_HC, to: ["servicedesk@hansacequity.com"], transporter: "hc" },
//     "DBA":          { from: process.env.SMTP_USER_HC, to: ["suraj.jogale@hansacequity.com"], transporter: "hc" },
//   },
//   "hansa direct": {
//     "CRM":          { from: process.env.SMTP_USER_HD, to: ["crm@hansadirect.com"], transporter: "hd" },
//     "MIS":          { from: process.env.SMTP_USER_HD, to: ["suraj.jogale@hansacequity.com","ashish.jadhav@hansadirect.com","dakshata.dalavi@hansadirect.com"], transporter: "hd" },
//     "IT/HELP_DESK": { from: process.env.SMTP_USER_HD, to: ["suraj.jogale@hansacequity.com"], transporter: "hd" },
//     "DBA":          { from: process.env.SMTP_USER_HD, to: ["suraj.jogale@hansacequity.com"], transporter: "hd" }, // ✅ ADD
//   },
//   "autosense": {
//     "IT/HELP_DESK": { from: process.env.SMTP_USER_HD, to: ["itchennai@autosenseindia.com"], transporter: "hd" },
//     "DBA":          { from: process.env.SMTP_USER_HD, to: ["suraj.jogale@hansacequity.com"], transporter: "hd" }, // ✅ ADD
//   },
// };

const teamEmails = {
  "hansa cequity": {
    "IT/HELP_DESK": { from: process.env.SMTP_USER_HC, to: ["servicedesk@hansacequity.com"], transporter: "hc" },
    "DBA":          { from: process.env.SMTP_USER_HC, to: ["dbasupport@hansacequity.com"], transporter: "hc" },
  },
  "hansa direct": {
    "CRM":          { from: process.env.SMTP_USER_HD, to: ["crm@hansadirect.com"], transporter: "hd" },
    "MIS":          { from: process.env.SMTP_USER_HD, to: ["abhishek.sharma@hansadirect.com","ashish.jadhav@hansadirect.com","dakshata.dalavi@hansadirect.com"], transporter: "hd" },
    "IT/HELP_DESK": { from: process.env.SMTP_USER_HD, to: ["helpdesk@hansadirect.com"], transporter: "hd" },
    "DBA":          { from: process.env.SMTP_USER_HD, to: ["dbasupport@hansacequity.com"], transporter: "hd" }, // ✅ ADD
  },
  "autosense": {
    "IT/HELP_DESK": { from: process.env.SMTP_USER_HD, to: ["itchennai@autosenseindia.com"], transporter: "hd" },
    "DBA":          { from: process.env.SMTP_USER_HD, to: ["dbasupport@hansacequity.com"], transporter: "hd" }, // ✅ ADD
  },
};

// Move/import this so mailer.js and ticketController.js share one definition
const normalizeTeamKey = (teamName) => {
  const t = (teamName || '').toUpperCase().trim();
  if (t === 'IT SERVICES' || t === 'IT SERVICE' || t === 'HELP DESK' || t === 'HELPDESK') {
    return 'IT/HELP_DESK';
  }
  return t; // CRM, MIS, DBA etc. presumably already match
};

const getTeamEmailConfig = (orgName, teamName) => {
  console.log("Team Name",teamName);
  console.log("OrgName",orgName);
  const org  = (orgName || '').toLowerCase().trim();
  const team = normalizeTeamKey(teamName);
  const entry = teamEmails[org]?.[team];
  if (!entry) {
    logger.warn(`⚠️ No teamEmails entry for org="${org}" team="${team}" (raw="${teamName}")`);
    return null;
  }
  return entry;
};



// ─── PICK CORRECT TRANSPORTER ─────────────────────────────────────────────────
const getTransporter = (key) => key === "hc" ? transporterHC : transporterHD;

// ═══════════════════════════════════════════════════════════════════════════════
// ─── SINGLE SOURCE OF TRUTH: ORG → TRANSPORTER KEY ───────────────────────────
//
// ROOT CAUSE OF THE BUG:
//   Previously, every function independently did: orgName.includes('hansa cequity')
//   If ticket.org_name was undefined/null/empty (which happens because INSERT
//   RETURNING * does NOT include JOIN columns like org_name), the check silently
//   fell through to 'hd' — so Hansa Cequity users got ticketing.portal@hansadirect.com
//
// FIX:
//   1. All functions now call resolveTransporterKey(orgName) — one place to change.
//   2. sendTicketCreatedMail and sendApprovalDecisionMail now accept orgName as an
//      EXPLICIT parameter from the controller, which always has it from req.body.
//      They no longer rely on ticket.org_name (which can be undefined after INSERT).
//
// RULE: Hansa Cequity → 'hc' (no-reply@hansacequity.com)
//       Hansa Direct, Autosense, anything else → 'hd' (ticketing.portal@hansadirect.com)
// ═══════════════════════════════════════════════════════════════════════════════
const resolveTransporterKey = (orgName) => {
  const org = (orgName || '').toLowerCase().trim();
  if (org.includes('hansa cequity')) return 'hc';
  return 'hd';
};

const resolveFromEmail = (orgName) => {
  return resolveTransporterKey(orgName) === 'hc'
    ? process.env.SMTP_USER_HC
    : process.env.SMTP_USER_HD;
};

// ─── GENERIC SEND ─────────────────────────────────────────────────────────────
const sendMail = async (to, subject, html, cc = [], from = null, transporterKey = "hc") => {
  try {
    if (!to) return;
    const transporter = getTransporter(transporterKey);
    await transporter.sendMail({
      from: from || process.env.SMTP_USER_HC,
      to,
      cc,
      subject,
      html,
    });
    logger.info(`Mail sent to: ${Array.isArray(to) ? to.join(', ') : to}${cc.length ? ` | CC: ${cc.join(', ')}` : ''}`);
  } catch (err) {
    logger.error(`Mail error: ${err.message}`);
  }
};

// ─── OTP MAIL ─────────────────────────────────────────────────────────────────
const sendOtpMail = async (email, otp) => {
  const html = `
    <h2>Email Verification</h2>
    <p>Your OTP is: <strong>${otp}</strong></p>
    <p>This OTP will expire in 5 minutes.</p>
  `;
  return sendMail(email, 'OTP Verification', html);
};

// ─── WELCOME MAIL ─────────────────────────────────────────────────────────────
const sendWelcomeMail = async (email, password) => {
  const html = `
    <h2>Welcome to the Ticketing Portal</h2>
    <p>Your account has been created successfully.</p>
    <p><b>E-Mail:</b> ${email}</p>
    <p><b>Password:</b> ${password}</p>
  `;
  return sendMail(email, 'Account Created', html);
};

// ─── SHARED HTML BUILDER ──────────────────────────────────────────────────────
const buildTicketHtml = (heading, ticket, assignedLabel) => `
  <h3>${heading}</h3>
  <p>Ticket has been assigned to <b>${assignedLabel}</b>.</p>
  <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;">
    <tr style="background:#f5f5f5;"><td style="padding:8px;"><b>Ticket No</b></td><td style="padding:8px;">${ticket.ticket_number}</td></tr>
    <tr><td style="padding:8px;"><b>Subject</b></td><td style="padding:8px;">${ticket.subject}</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding:8px;"><b>Raised By</b></td><td style="padding:8px;">${ticket.created_by_name || 'N/A'}</td></tr>
    <tr><td style="padding:8px;"><b>Priority</b></td><td style="padding:8px;">${ticket.priority}</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding:8px;"><b>Issue</b></td><td style="padding:8px;">${ticket.issue_name || 'N/A'}</td></tr>
    <tr><td style="padding:8px;"><b>Client</b></td><td style="padding:8px;">${ticket.client_name || 'N/A'}</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding:8px;"><b>Description</b></td><td style="padding:8px;">${ticket.description || 'N/A'}</td></tr>
    <tr><td style="padding:8px;"><b>SLA Due</b></td><td style="padding:8px;">${ticket.sla_due_at ? new Date(ticket.sla_due_at).toLocaleString() : 'N/A'}</td></tr>
    <tr><td style="padding:8px;"><b>Desk Number</b></td><td style="padding:8px;">${ticket.desk_number}</td></tr>
    <tr style="background:#f5f5f5;">
  <td style="padding:8px;border:1px solid #ddd;"><b>Wing Name</b></td>
  <td style="padding:8px;border:1px solid #ddd;">
    ${{
      3: 'A',
      4: 'B',
      5: 'C'
    }[ticket.wing_id] || 'N/A'}
  </td>
</tr>
  </table>
  <p style="color:#666;font-size:13px;">Please log in to the portal to view or update this ticket.</p>
`;

// ─── TICKET CREATED — with Approve/Not Approve buttons ───────────────────────
//
// @param ticket       — saved ticket row from INSERT RETURNING *
//                       NOTE: ticket.org_name may be undefined here because
//                       INSERT RETURNING * does NOT include JOIN columns.
// @param creatorEmail — email of the user who created the ticket
// @param orgName      — EXPLICITLY passed from the controller (req.body.org_name)
//                       ALWAYS use this — never rely on ticket.org_name alone.
//
const sendTicketCreatedMail = async (ticket, creatorEmail, orgName, managerEmails = [],teamName = '') => {
  try {
    // ── Use explicit orgName; fallback to ticket.org_name only as last resort ──
    const resolvedOrg = (orgName || ticket.org_name || '').toLowerCase().trim();
    const resolvedTeam = teamName || ticket.team_name || '';
    const assignedTo  = (ticket.assigned_to_name || '').toUpperCase().trim();

    // ── Single-point transporter resolution ──────────────────────────────────
    const tKey  = resolveTransporterKey(resolvedOrg);
    const tFrom = resolveFromEmail(resolvedOrg);
    const approverDisplay = ticket.approver_email || ticket.email_id || 'the designated approver';

    logger.info(`📨 sendTicketCreatedMail → org: "${resolvedOrg}" | transporter: "${tKey}" | from: "${tFrom}"`);

    // ── Team manager recipients (the HEAD of the ticket's team — e.g. the head
    //    of IT Service — resolved from the DB by the controller). This REPLACES
    //    the old hardcoded distribution list. ──────────────────────────────────
    // const teamMgrList = (managerEmails || []).filter(Boolean);
    // if (!teamMgrList.length) {
    // const teamConfig = getTeamEmailConfig(resolvedOrg, ticket.team_name);
    console.log("Org:", resolvedOrg);
    console.log("Team:", resolvedTeam);
    const teamConfig = getTeamEmailConfig(resolvedOrg, resolvedTeam);
    console.log("Team Config:", teamConfig);
    const teamMgrList = [...new Set([...(managerEmails || []), ...(teamConfig?.to || [])])].filter(Boolean);
    if (!teamMgrList.length) {
      logger.warn(`⚠️ No team manager found for ticket ${ticket.ticket_number} ` +
                  `(team=${ticket.assigned_team_id}, location=${ticket.location_id}). ` +
                  `Team-manager notice NOT sent.`);
    }

    // ── Build approval button URLs ────────────────────────────────────────────
    const baseUrl    = process.env.APP_BASE_URL || `http://192.168.5.245:${process.env.PORT || 3008}`;
    const approveUrl = `${baseUrl}/api/tickets-generate/approve/${ticket.approval_token}?action=approved`;
    const rejectUrl  = `${baseUrl}/api/tickets-generate/approve/${ticket.approval_token}?action=not_approved`;

    // ── Email HTML: approval-request (for email_id person) ───────────────────
    const approvalHtml = `
      <div style="font-family:sans-serif;font-size:14px;max-width:600px;">
        <h3 style="color:#1a1a2e;">Approval Required — New Support Ticket</h3>
        <p>A new support ticket has been raised and requires your approval before the IT team can proceed.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:20px;">
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>Ticket No</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.ticket_number}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;"><b>Subject</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.subject}</td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>Raised By</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.created_by_name || 'N/A'}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;"><b>Priority</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.priority}</td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>Issue</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.issue_name || 'N/A'}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;"><b>Client</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.client_name || 'N/A'}</td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>Assigned Team</b></td><td style="padding:8px;border:1px solid #ddd;">${assignedTo || 'IT Team'}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;"><b>Description</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.description || 'N/A'}</td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>SLA Due</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.sla_due_at ? new Date(ticket.sla_due_at).toLocaleString() : 'N/A'}</td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>Desk number</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.desk_number}</td></tr>
          <tr style="background:#f5f5f5;">
          <td style="padding:8px;border:1px solid #ddd;"><b>Wing Name</b></td>
          <td style="padding:8px;border:1px solid #ddd;">
            ${{
              3: 'A',
              4: 'B',
              5: 'C',
            
    }[ticket.wing_id] || 'N/A'}
  </td>
</tr>
        </table>
        <p style="font-weight:bold;margin-bottom:12px;">Please take action on this ticket:</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${approveUrl}"
            style="display:inline-block;padding:12px 32px;background:#16a34a;color:#fff;
                   text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;margin-right:16px;">
            ✅ Approve
          </a>
          <a href="${rejectUrl}"
            style="display:inline-block;padding:12px 32px;background:#dc2626;color:#fff;
                   text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;">
            ❌ Not Approve
          </a>
        </div>
        <p style="color:#888;font-size:12px;margin-top:20px;">
          Clicking a button will record your decision and notify the ticket owner and IT Service team.<br/>
          Each link can only be used once.
        </p>
      </div>
    `;

    // ── Email HTML: info-only (for the TEAM MANAGER / head of the team) ───────
    const itTeamHtml = `
      <div style="font-family:sans-serif;font-size:14px;max-width:600px;">
        <h3 style="color:#1a1a2e;">New Ticket Raised for Your Team — Pending Approval</h3>
        <p>A new ticket has been raised for your team. It is currently <b>pending approval</b> from <b>${approverDisplay}</b>. Once approved, you will be able to assign it to a member of your team.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>Ticket No</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.ticket_number}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;"><b>Subject</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.subject}</td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>Raised By</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.created_by_name || 'N/A'}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;"><b>Priority</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.priority}</td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>Issue</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.issue_name || 'N/A'}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;"><b>Description</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.description || 'N/A'}</td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>SLA Due</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.sla_due_at ? new Date(ticket.sla_due_at).toLocaleString() : 'N/A'}</td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>SLA Due</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.desk_number}</td></tr>
          <tr style="background:#f5f5f5;">
          <td style="padding:8px;border:1px solid #ddd;"><b>Wing Name</b></td>
          <td style="padding:8px;border:1px solid #ddd;">
            ${{
              3: 'A',
              4: 'B',
              5: 'C'
            }[ticket.wing_id] || 'N/A'}
          </td>
        </tr>
        </table>
        <p style="color:#666;font-size:13px;margin-top:16px;">No action is required from you at this time.</p>
      </div>
    `;

    // ── Email HTML: confirmation (for ticket creator) ─────────────────────────
    const creatorHtml = `
      <div style="font-family:sans-serif;font-size:14px;max-width:600px;">
        <h3>Your Ticket Has Been Raised Successfully</h3>
        <p>Your ticket <b>${ticket.ticket_number}</b> has been submitted and is currently <b>pending approval</b>.</p>
        <p>The designated approver (<b>${approverDisplay}</b>) has been notified. You will receive an update once they respond.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>Ticket No</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.ticket_number}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;"><b>Subject</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.subject}</td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>Priority</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.priority}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;"><b>Status</b></td><td style="padding:8px;border:1px solid #ddd;">Pending Approval</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;"><b>Deks Number</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.desk_number}</td></tr>
          <tr style="background:#f5f5f5;">
        <td style="padding:8px;border:1px solid #ddd;"><b>Wing Name</b></td>
        <td style="padding:8px;border:1px solid #ddd;">
          ${{
            3: 'A',
            4: 'B',
            5: 'C'
          }[ticket.wing_id] || 'N/A'}
        </td>
      </tr>
        </table>
      </div>
    `;

    // ── STEP 1: Send approval-request to the AUTO-SELECTED approver ───────────
    // Approver is resolved from the registry at creation (ticket.approver_email).
    // Fall back to the legacy requester-typed email_id only if none is configured.
    const approverList = (ticket.approver_email || ticket.email_id || '')
      .split(',').map(e => e.trim()).filter(Boolean);
    if (approverList.length > 0) {
      await sendMail(
        approverList.join(','),
        `Approval Required: Ticket ${ticket.ticket_number} | ${ticket.subject}`,
        approvalHtml, [], tFrom, tKey
      );
      logger.info(`✅ Approval mail sent via "${tKey}" (${tFrom}) → ${approverList.join(', ')}`);
    } else {
      logger.warn(`⚠️ No approver configured for ticket ${ticket.ticket_number} ` +
                  `(location/team has no registry entry). Approval email NOT sent — ` +
                  `ticket will stay Pending Approval until an approver is added.`);
    }

    // ── STEP 2: Notify the TEAM MANAGER (head of the ticket's team) ───────────
    if (teamMgrList.length) {
      await sendMail(
        teamMgrList.join(','),
        `New Ticket Pending Approval: ${ticket.ticket_number} | ${ticket.subject}`,
        itTeamHtml, [], tFrom, tKey
      );
      logger.info(`✅ Team-manager notice sent via "${tKey}" → ${teamMgrList.join(', ')}`);
    }

    // ── STEP 3: Send confirmation to ticket creator ───────────────────────────
    if (creatorEmail) {
      await sendMail(
        creatorEmail,
        `Ticket Raised: ${ticket.ticket_number}`,
        creatorHtml, [], tFrom, tKey
      );
      logger.info(`✅ Creator confirmation sent via "${tKey}" (${tFrom}) → ${creatorEmail}`);
    }

  } catch (err) {
    logger.error(`❌ sendTicketCreatedMail error: ${err.message}`);
  }
};

// ─── APPROVAL DECISION MAIL ───────────────────────────────────────────────────
//
// @param ticket        — ticket object (from DB SELECT with JOINs — org_name IS available here)
// @param decision      — 'approved' | 'not_approved'
// @param approverEmail — email of who clicked the button
// @param creatorEmail  — ticket owner's email
// @param itTeamEmails  — array of IT team emails
// @param orgName       — EXPLICITLY passed from controller for reliable transporter resolution
//
const sendApprovalDecisionMail = async (ticket, decision, approverEmail, creatorEmail, itTeamEmails, orgName) => {
  try {
    const resolvedOrg = (orgName || ticket.org_name || '').toLowerCase().trim();
    const tKey        = resolveTransporterKey(resolvedOrg);
    const tFrom       = resolveFromEmail(resolvedOrg);

    logger.info(`📨 sendApprovalDecisionMail → org: "${resolvedOrg}" | transporter: "${tKey}" | from: "${tFrom}"`);

    const isApproved    = decision === 'approved';
    const decisionLabel = isApproved ? '✅ Approved' : '❌ Not Approved';
    const decisionColor = isApproved ? '#16a34a' : '#dc2626';
    const actionNote    = isApproved
      ? 'The IT Service team has been notified and will now assign and work on this ticket.'
      : 'The IT Service team has been notified. No further action will be taken on this ticket unless it is re-raised.';

    const html = `
      <div style="font-family:sans-serif;font-size:14px;max-width:600px;">
        <h3 style="color:${decisionColor};">Ticket ${decisionLabel}</h3>
        <p>Ticket <b>${ticket.ticket_number}</b> has been reviewed by <b>${approverEmail}</b> and marked as <b style="color:${decisionColor};">${decisionLabel}</b>.</p>
        <p>${actionNote}</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;margin-top:16px;">
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>Ticket No</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.ticket_number}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;"><b>Subject</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.subject}</td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>Raised By</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.created_by_name || 'N/A'}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;"><b>Priority</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.priority}</td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>Issue</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.issue_name || 'N/A'}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;"><b>Decision By</b></td><td style="padding:8px;border:1px solid #ddd;">${approverEmail}</td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>Decision</b></td><td style="padding:8px;border:1px solid #ddd;color:${decisionColor};font-weight:bold;">${decisionLabel}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;"><b>Decided At</b></td><td style="padding:8px;border:1px solid #ddd;">${new Date().toLocaleString()}</td></tr>
          <tr style="background:#f5f5f5;">
          <td style="padding:8px;border:1px solid #ddd;"><b>Wing Name</b></td>
          <td style="padding:8px;border:1px solid #ddd;">
            ${{
              3: 'A',
              4: 'B',
              5: 'C'
            }[ticket.wing_id] || 'N/A'}
          </td>
        </tr>
        </table>
        <p style="color:#666;font-size:13px;margin-top:16px;">Please log in to the portal to view full ticket details.</p>
      </div>
    `;

    const subject = `Ticket ${isApproved ? 'Approved' : 'Not Approved'}: ${ticket.ticket_number} | ${ticket.subject}`;

    if (creatorEmail) {
      await sendMail(creatorEmail, subject, html, [], tFrom, tKey);
      logger.info(`✅ Decision mail sent via "${tKey}" to owner → ${creatorEmail}`);
    }
    const teamConfig = getTeamEmailConfig(resolvedOrg, ticket.team_name);
    itTeamEmails = [...new Set([...(itTeamEmails || []), ...(teamConfig?.to || [])])];
    if (itTeamEmails && itTeamEmails.length > 0) {
      await sendMail(itTeamEmails.join(','), subject, html, [], tFrom, tKey);
      logger.info(`✅ Decision mail sent via "${tKey}" to IT team → ${itTeamEmails.join(', ')}`);
    }

  } catch (err) {
    logger.error(`❌ sendApprovalDecisionMail error: ${err.message}`);
  }
};

// ─── TICKET UPDATED ───────────────────────────────────────────────────────────
const sendTicketUpdatedMail = async (ticket, changedFields, creatorEmail) => {
  if (!ticket || !creatorEmail) {
    if (!creatorEmail) logger.warn(`No creator email for ticket ${ticket?.ticket_number}, skipping update mail`);
    return;
  }

  const tKey  = resolveTransporterKey(ticket.org_name);
  const tFrom = resolveFromEmail(ticket.org_name);

  const changeRows = Object.entries(changedFields)
    .map(([key, val]) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;"><b>${key}</b></td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${val}</td>
      </tr>`).join('');

  const html = `
    <h3>Your Ticket Has Been Updated</h3>
    <p>The IT team has made changes to your ticket.</p>
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;margin-bottom:16px;">
      <tr style="background:#f5f5f5;"><td style="padding:8px;border-bottom:1px solid #eee;"><b>Ticket No</b></td><td style="padding:8px;border-bottom:1px solid #eee;">${ticket.ticket_number}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;"><b>Subject</b></td><td style="padding:8px;border-bottom:1px solid #eee;">${ticket.subject}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px;border-bottom:1px solid #eee;"><b>Assigned To</b></td><td style="padding:8px;border-bottom:1px solid #eee;">${ticket.assigned_to_name || 'N/A'}</td></tr>
    </table>
    <h4 style="margin-bottom:8px;">Changes Made:</h4>
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;">${changeRows}</table>
    <p style="color:#666;font-size:13px;margin-top:16px;">Log in to the portal to view full ticket details.</p>
  `;

  await sendMail(creatorEmail, `Ticket Updated: ${ticket.ticket_number} | ${ticket.subject}`, html, [], tFrom, tKey);
};

// ─── TICKET ASSIGNED ──────────────────────────────────────────────────────────
const sendTicketAssignedMail = async (ticket, assigneeEmail, creatorEmail) => {
  if (!ticket) return;
  logger.info(`📧 Sending assignment emails for ticket ${ticket.ticket_number}`);

  const tKey  = resolveTransporterKey(ticket.org_name);
  const tFrom = resolveFromEmail(ticket.org_name);
  console.log('[DEBUG sendTicketAssignedMail] ticket.org_name =', JSON.stringify(ticket.org_name));
console.log('[DEBUG sendTicketAssignedMail] ticket.team_name =', JSON.stringify(ticket.team_name));
console.log('[DEBUG sendTicketAssignedMail] normalized team  =', normalizeTeamKey(ticket.team_name));

  const teamConfig = getTeamEmailConfig(ticket.org_name, ticket.team_name);
  console.log('[DEBUG sendTicketAssignedMail] teamConfig =', JSON.stringify(teamConfig));

  const teamCc = teamConfig?.to || [];

  const html = `
    <h3>Ticket Assigned to You</h3>
    <p>A support ticket has been assigned. Please review and take action.</p>
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;">
      <tr style="background:#f5f5f5;"><td style="padding:8px;border-bottom:1px solid #eee;"><b>Ticket No</b></td><td style="padding:8px;border-bottom:1px solid #eee;">${ticket.ticket_number}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;"><b>Subject</b></td><td style="padding:8px;border-bottom:1px solid #eee;">${ticket.subject}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px;border-bottom:1px solid #eee;"><b>Raised By</b></td><td style="padding:8px;border-bottom:1px solid #eee;">${ticket.created_by_name || 'N/A'}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;"><b>Priority</b></td><td style="padding:8px;border-bottom:1px solid #eee;">${ticket.priority}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px;border-bottom:1px solid #eee;"><b>Issue</b></td><td style="padding:8px;border-bottom:1px solid #eee;">${ticket.issue_name || 'N/A'}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;"><b>Assigned To</b></td><td style="padding:8px;border-bottom:1px solid #eee;">${ticket.assigned_to_name || 'N/A'}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px;border-bottom:1px solid #eee;"><b>Status</b></td><td style="padding:8px;border-bottom:1px solid #eee;">In Progress</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;"><b>SLA Due</b></td><td style="padding:8px;border-bottom:1px solid #eee;">${ticket.sla_due_at ? new Date(ticket.sla_due_at).toLocaleString() : 'N/A'}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px;border-bottom:1px solid #eee;"><b>Description</b></td><td style="padding:8px;border-bottom:1px solid #eee;">${ticket.description || 'N/A'}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px;border-bottom:1px solid #eee;"><b>Desk Number</b></td><td style="padding:8px;border-bottom:1px solid #eee;">${ticket.desk_number}</td></tr>
      
      <tr style="background:#f5f5f5;">
      <td style="padding:8px;border:1px solid #ddd;"><b>Wing Name</b></td>
      <td style="padding:8px;border:1px solid #ddd;">
        ${{
          3: 'A',
          4: 'B',
          5: 'C'
        }[ticket.wing_id] || 'N/A'}
      </td>
    </tr>
    </table>
    <p style="color:#666;font-size:13px;margin-top:16px;">Please log in to the portal to view or update this ticket.</p>
  `;

  const creatorHtml = html
    .replace('<h3>Ticket Assigned to You</h3>', '<h3>Your Ticket Has Been Assigned</h3>')
    .replace('A support ticket has been assigned. Please review and take action.', 'Your ticket has been assigned to a team member. You will be notified of any updates.');

  if (assigneeEmail) {
    await sendMail(assigneeEmail, `Ticket Assigned: ${ticket.ticket_number} | ${ticket.subject}`, html, teamCc, tFrom, tKey);
    logger.info(`✅ Assignee mail sent via "${tKey}" → ${assigneeEmail}`);
  }
  if (creatorEmail && creatorEmail !== assigneeEmail) {
    await sendMail(creatorEmail, `Your Ticket Has Been Assigned: ${ticket.ticket_number}`, creatorHtml, teamCc, tFrom, tKey);
    logger.info(`✅ Creator mail sent via "${tKey}" → ${creatorEmail}`);
  }
  logger.info(`📧 Assignment complete for ${ticket.ticket_number}`);
};


const sendTicketReopenedMail = async (ticket, creatorEmail, orgName, managerEmails, assigneeEmail) => {
  try {
    const tKey  = resolveTransporterKey(orgName);
    const tFrom = resolveFromEmail(orgName);
    const teamConfig = getTeamEmailConfig(orgName, ticket.team_name);  
    const staticTeamEmails = teamConfig?.to || [];   

    const html = `
      <div style="font-family:sans-serif;font-size:14px;max-width:600px;">
        <h3 style="color:#f59e0b;">🔄 Ticket Reopened</h3>
        <p>Ticket <b>#${ticket.ticket_number}</b> — <b>${ticket.subject}</b> has been <b>Reopened</b> by the requester.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>Ticket No</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.ticket_number}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;"><b>Subject</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.subject}</td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>Priority</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.priority}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;"><b>Issue</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.issue_name || 'N/A'}</td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>Raised By</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.created_by_name || 'N/A'}</td></tr>
         
          <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><b>Desk Number</b></td><td style="padding:8px;border:1px solid #ddd;">${ticket.desk_number}</td></tr>
        </table>
        <p style="color:#666;font-size:13px;margin-top:16px;">Please log in to the portal to review and take action.</p>
      </div>
    `;

    const subject = `[Reopened] Ticket #${ticket.ticket_number} — ${ticket.subject}`;

    const recipients = [
      ...(managerEmails || []),
      ...(assigneeEmail ? [assigneeEmail] : []),
      ...staticTeamEmails,
      ...(creatorEmail  ? [creatorEmail]  : []),
      
    ].filter(Boolean);

    const uniqueRecipients = [...new Set(recipients)];

    for (const to of uniqueRecipients) {
      await sendMail(to, subject, html, [], tFrom, tKey);
    }

    logger.info(`✅ Reopen mail sent via "${tKey}" → ${uniqueRecipients.join(', ')}`);
  } catch (err) {
    logger.error(`❌ sendTicketReopenedMail error: ${err.message}`);
  }
};
module.exports = {
  sendMail,
  sendOtpMail,
  sendWelcomeMail,
  sendTicketCreatedMail,
  sendTicketUpdatedMail,
  sendTicketAssignedMail,
  sendApprovalDecisionMail,
  sendTicketReopenedMail,
  getTeamEmailConfig
};