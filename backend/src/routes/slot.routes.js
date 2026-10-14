const router = require('express').Router();
const controller = require('../controllers/slot.controller');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { ROLES } = require('../utils/constants');
const { slotsQuery } = require('../validators/slot.validator');

router.get('/', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST), validate({ query: slotsQuery }), controller.list);

module.exports = router;
