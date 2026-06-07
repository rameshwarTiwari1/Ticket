const { saveOtp, verifyOtp } = require('../models/otpModel');
const { sendOtpMail } = require('../utils/mailer');

exports.sendOtp = async (req, res) => {
  const { email_id } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await saveOtp(email_id, otp);
  await sendOtpMail(email_id, otp);

  res.json({ message: 'OTP sent successfully' });
};

exports.verifyOtp = async (req, res) => {
  const { email_id, otp } = req.body;

  const valid = await verifyOtp(email_id, otp);
  if (!valid) return res.status(400).json({ error: 'Invalid OTP' });

  res.json({ message: 'OTP verified' });
};
