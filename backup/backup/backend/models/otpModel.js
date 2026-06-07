const db = require('../config/db');

const saveOtp = async (email, otp) => {
  await db.query(
    `INSERT INTO T_EMAIL_OTP (email_id, otp, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
    [email, otp]
  );
};

const verifyOtp = async (email, otp) => {
  const res = await db.query(
    `SELECT * FROM T_EMAIL_OTP 
     WHERE email_id=$1 AND otp=$2 AND expires_at > NOW()`,
    [email, otp]
  );
  return res.rows.length > 0;
};

module.exports = { saveOtp, verifyOtp };
