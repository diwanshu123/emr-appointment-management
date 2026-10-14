const router = require('express').Router();
const controller = require('../controllers/user.controller');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { ROLES } = require('../utils/constants');
const { createDepartmentBody } = require('../validators/user.validator');

router.use(authenticate);
router.get('/', controller.listDepartments);
router.post('/', authorize(ROLES.SUPER_ADMIN), validate({ body: createDepartmentBody }), controller.createDepartment);

module.exports = router;
