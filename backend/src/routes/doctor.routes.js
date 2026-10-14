const router = require('express').Router();
const controller = require('../controllers/doctor.controller');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { ROLES } = require('../utils/constants');
const { idParams } = require('../validators/common');
const { createDoctorBody, updateScheduleBody, listDoctorsQuery } = require('../validators/doctor.validator');

router.use(authenticate);

router.get('/', validate({ query: listDoctorsQuery }), controller.list);
router.get('/:id', validate({ params: idParams }), controller.get);
router.post('/', authorize(ROLES.SUPER_ADMIN), validate({ body: createDoctorBody }), controller.create);
router.put(
  '/:id/schedule',
  authorize(ROLES.SUPER_ADMIN),
  validate({ params: idParams, body: updateScheduleBody }),
  controller.updateSchedule
);

module.exports = router;
