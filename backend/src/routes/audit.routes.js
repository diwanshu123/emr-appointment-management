const router = require('express').Router();
const controller = require('../controllers/audit.controller');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { ROLES } = require('../utils/constants');
const { listAuditQuery } = require('../validators/audit.validator');

router.get('/', authenticate, authorize(ROLES.SUPER_ADMIN), validate({ query: listAuditQuery }), controller.list);

module.exports = router;
