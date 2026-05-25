const router = require('express').Router();
const auth = require('../middleware/auth');
const { validate, categoryCreateSchema, categoryUpdateSchema } = require('../middleware/validate');
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categories');

router.get('/', auth, getCategories);
router.post('/', auth, validate(categoryCreateSchema), createCategory);
router.put('/:id', auth, validate(categoryUpdateSchema), updateCategory);
router.delete('/:id', auth, deleteCategory);

module.exports = router;
