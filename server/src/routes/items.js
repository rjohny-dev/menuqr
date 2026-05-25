const router = require('express').Router();
const auth = require('../middleware/auth');
const { validate, itemCreateSchema, itemUpdateSchema } = require('../middleware/validate');
const { getItems, createItem, updateItem, deleteItem } = require('../controllers/items');

router.get('/category/:categoryId', auth, getItems);
router.post('/category/:categoryId', auth, validate(itemCreateSchema), createItem);
router.put('/:id', auth, validate(itemUpdateSchema), updateItem);
router.delete('/:id', auth, deleteItem);

module.exports = router;
