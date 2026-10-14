const router = require('express').Router();
const controller = require('../controllers/user.controller');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { ROLES } = require('../utils/constants');
const { createReceptionistBody } = require('../validators/user.validator');

router.use(authenticate, authorize(ROLES.SUPER_ADMIN));
router.post('/receptionists', validate({ body: createReceptionistBody }), controller.createReceptionist);

module.exports = router;
