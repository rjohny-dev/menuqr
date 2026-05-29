const router = require('express').Router();
const {
  register, login, logout, refresh,
  verifyEmail, resendVerification,
  forgotPassword, resetPassword,
} = require('../controllers/auth');
const auth = require('../middleware/auth');
const { loginLimiter, authLimiter } = require('../middleware/rateLimiter');
const { validate, registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../middleware/validate');

router.post('/register',             authLimiter,  validate(registerSchema),       register);
router.post('/login',                loginLimiter, validate(loginSchema),           login);
router.post('/logout',               auth,                                          logout);
router.post('/refresh',              authLimiter,                                   refresh);
router.get( '/verify-email',         authLimiter,                                   verifyEmail);
router.post('/resend-verification',  authLimiter,                                   resendVerification);
router.post('/forgot-password',      authLimiter,                                   forgotPassword);
router.post('/reset-password',       authLimiter,  validate(resetPasswordSchema),   resetPassword);

module.exports = router;
