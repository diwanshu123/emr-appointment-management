const router = require('express').Router();
const controller = require('../controllers/patient.controller');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { ROLES } = require('../utils/constants');
const { idParams } = require('../validators/common');
const { searchPatientsQuery } = require('../validators/patient.validator');

router.use(authenticate);
router.get('/', authorize(ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST), validate({ query: searchPatientsQuery }), controller.search);
router.get('/:id', authorize(ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR), validate({ params: idParams }), controller.get);

module.exports = router;
