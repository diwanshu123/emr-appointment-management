const router = require('express').Router();
const controller = require('../controllers/appointment.controller');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { ROLES } = require('../utils/constants');
const { idParams } = require('../validators/common');
const { createBody, updateBody, cancelBody, listQuery } = require('../validators/appointment.validator');

const { SUPER_ADMIN, RECEPTIONIST, DOCTOR } = ROLES;
const staff = [SUPER_ADMIN, RECEPTIONIST];

router.use(authenticate);

router.post('/', authorize(...staff), validate({ body: createBody }), controller.create);
router.get('/', authorize(SUPER_ADMIN, RECEPTIONIST, DOCTOR), validate({ query: listQuery }), controller.list);
router.get('/:id', authorize(SUPER_ADMIN, RECEPTIONIST, DOCTOR), validate({ params: idParams }), controller.get);
router.put('/:id', authorize(SUPER_ADMIN, RECEPTIONIST, DOCTOR), validate({ params: idParams, body: updateBody }), controller.update);
router.delete('/:id', authorize(...staff), validate({ params: idParams, body: cancelBody }), controller.cancel);
router.post('/:id/arrive', authorize(...staff), validate({ params: idParams }), controller.arrive);
router.post('/:id/complete', authorize(SUPER_ADMIN, DOCTOR), validate({ params: idParams }), controller.complete);

module.exports = router;
