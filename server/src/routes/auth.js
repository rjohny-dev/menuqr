const router = require('express').Router();
const { register, login, logout } = require('../controllers/auth');
const auth = require('../middleware/auth');
const { loginLimiter, authLimiter } = require('../middleware/rateLimiter');
const { validate, registerSchema, loginSchema } = require('../middleware/validate');

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/logout', auth, logout);

module.exports = router;
