const router = require('express').Router();
const auth = require('../middleware/auth');
const { validate, optionGroupCreateSchema, optionGroupUpdateSchema, optionCreateSchema, optionUpdateSchema } = require('../middleware/validate');
const ctrl = require('../controllers/optionGroups');

router.get('/item/:itemId',            auth, ctrl.getGroups);
router.post('/item/:itemId',           auth, validate(optionGroupCreateSchema), ctrl.createGroup);
router.put('/:id',                     auth, validate(optionGroupUpdateSchema),  ctrl.updateGroup);
router.delete('/:id',                  auth, ctrl.deleteGroup);
router.post('/:groupId/options',       auth, validate(optionCreateSchema),       ctrl.createOption);
router.put('/options/:optionId',       auth, validate(optionUpdateSchema),        ctrl.updateOption);
router.delete('/options/:optionId',    auth, ctrl.deleteOption);

module.exports = router;
