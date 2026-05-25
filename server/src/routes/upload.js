const router = require('express').Router();
const auth = require('../middleware/auth');
const { handleSingle } = require('../middleware/upload');
const { uploadImage } = require('../controllers/upload');

router.post('/image', auth, handleSingle('image'), uploadImage);

module.exports = router;
