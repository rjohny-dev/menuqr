const router = require('express').Router();
const auth = require('../middleware/auth');
const { validate, restaurantCreateSchema, restaurantUpdateSchema } = require('../middleware/validate');
const { getRestaurant, createRestaurant, updateRestaurant } = require('../controllers/restaurant');

router.get('/', auth, getRestaurant);
router.post('/', auth, validate(restaurantCreateSchema), createRestaurant);
router.put('/', auth, validate(restaurantUpdateSchema), updateRestaurant);

module.exports = router;
