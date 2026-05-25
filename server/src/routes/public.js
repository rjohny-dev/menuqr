const router = require('express').Router();
const { getMenuBySlug } = require('../controllers/public');
const { publicLimiter } = require('../middleware/rateLimiter');

router.get('/:slug', publicLimiter, getMenuBySlug);

module.exports = router;
