const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);
router.post('/register', authController.registerUser); // new endpoint
router.post('/reset-password', authController.resetPassword);
module.exports = router;