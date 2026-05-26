const router = require('express').Router();
const { buscarCardapioPublico } = require('../controllers/public');
const { publicLimiter } = require('../middleware/rateLimiter');

router.get('/:slug', publicLimiter, buscarCardapioPublico);

module.exports = router;
