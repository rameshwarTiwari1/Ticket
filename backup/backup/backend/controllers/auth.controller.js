const pool   = require('../config/db');
const bcrypt = require('bcrypt');
const { sendOtpMail, sendWelcomeMail } = require('../utils/mailer');

// ─── HELPER: check OTP ────────────────────────────────────────────────────────
const checkOtp = async (email, otp) => {
  const result = await pool.query(
    `SELECT * FROM T_EMAIL_OTP
     WHERE email_id = $1 AND otp = $2 AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [email, otp]
  );
  return result.rows.length > 0;
};

// ─── SEND OTP ─────────────────────────────────────────────────────────────────
exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const otp    = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    await pool.query(
      `INSERT INTO T_EMAIL_OTP (email_id, otp, expires_at) VALUES ($1, $2, $3)`,
      [email, otp, expiry]
    );

    await sendOtpMail(email, otp);
    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('sendOtp error:', err);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
};

// ─── VERIFY OTP ───────────────────────────────────────────────────────────────
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ message: 'Email and OTP are required' });

    const valid = await checkOtp(email, otp);
    if (!valid)
      return res.status(400).json({ message: 'Invalid or expired OTP' });

    res.json({ message: 'OTP verified successfully' });
  } catch (err) {
    console.error('verifyOtp error:', err);
    res.status(500).json({ message: 'Server error while verifying OTP' });
  }
};

// ─── REGISTER USER ────────────────────────────────────────────────────────────
// Frontend sends: first_name, last_name, mobile_number, email_id,
//                 password, employee_id, team_name, org_name, otp
// NO location or wing — admin fills those later.
exports.registerUser = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      // mobile_number,
      email_id,
      password,
      employee_id,   // ✅ snake_case — matches frontend payload
      team_name,     // ✅ name, not ID — we resolve it below
      org_name,      // ✅ optional — resolved to org_id below
      otp,
    } = req.body;

    // ── 1. Validate required fields ──────────────────────────────────────────
    const missing = [];
    if (!first_name)    missing.push('first_name');
    if (!last_name)     missing.push('last_name');
    // if (!mobile_number) missing.push('mobile_number');
    if (!email_id)      missing.push('email_id');
    if (!password)      missing.push('password');
    if (!employee_id)   missing.push('employee_id');
    if (!team_name)     missing.push('team_name');
    if (!otp)           missing.push('otp');

    if (missing.length) {
      return res.status(400).json({
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    // ── 2. Validate OTP ──────────────────────────────────────────────────────
    const isOtpValid = await checkOtp(email_id, otp);
    if (!isOtpValid)
      return res.status(400).json({ message: 'Invalid or expired OTP' });

    // ── 3. Check duplicates ──────────────────────────────────────────────────
    const exists = await pool.query(
      `SELECT 1 FROM T_USER WHERE email_id = $1 OR employee_id = $2`,
      [email_id, employee_id]
    );
    if (exists.rows.length > 0)
      return res.status(409).json({ message: 'Email or Employee ID already registered' });

    // ── 4. Resolve team_name → team_id (+ the team's location) ───────────────
    // Every team belongs to exactly one location, so we stamp the new user's
    // location_id from their chosen team. Without this, location_id stays NULL
    // and the user cannot raise tickets (creation needs the creator's location).
    const teamRow = await pool.query(
      `SELECT team_id, location_id FROM T_TEAMS
       WHERE LOWER(TRIM(team_name)) = LOWER(TRIM($1))`,
      [team_name]
    );
    if (!teamRow.rows.length)
      return res.status(400).json({ message: `Team "${team_name}" not found` });

    const team_id     = teamRow.rows[0].team_id;
    const location_id = teamRow.rows[0].location_id;   // derived from the team

    // ── 5. Resolve org_name → org_id (optional) ──────────────────────────────
    let org_id = null;
    if (org_name) {
      const orgRow = await pool.query(
        `SELECT org_id FROM T_ORGANIZATION
         WHERE LOWER(TRIM(org_name)) = LOWER(TRIM($1))
         LIMIT 1`,
        [org_name]
      );
      if (!orgRow.rows.length)
        return res.status(400).json({ message: `Organization "${org_name}" not found` });
      org_id = orgRow.rows[0].org_id;
    }

    // ── 6. Hash password & insert ─────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 10);

    // Self-registered accounts default to the 'user' (requester) role.
    // Admin later assigns team/location and may promote to employee/manager.
    await pool.query(
      `INSERT INTO T_USER
         (employee_id, first_name, last_name,
          team_id, location_id, wing_id, email_id, password_hash, is_verified, org_id, role)
       VALUES ($1, $2, $3,  $4, $8, NULL, $5, $6, TRUE, $7, 'user')`,
      [employee_id, first_name, last_name,
       team_id, email_id, hashedPassword, org_id, location_id]
    );

    // ── 7. Send welcome email ─────────────────────────────────────────────────
    await sendWelcomeMail(email_id, password);

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('registerUser error:', err);
    if (err.code === '23505')
      return res.status(409).json({ message: 'Email or Employee ID already exists' });
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({ message: 'Email, OTP and new password are required' });

    const valid = await checkOtp(email, otp);
    if (!valid)
      return res.status(400).json({ message: 'Invalid or expired OTP' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE T_USER SET password_hash = $1 WHERE email_id = $2`,
      [hashedPassword, email]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ message: 'Password reset failed' });
  }
};