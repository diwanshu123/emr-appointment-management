const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/departments', require('./department.routes'));
router.use('/doctors', require('./doctor.routes'));
router.use('/slots', require('./slot.routes'));
router.use('/patients', require('./patient.routes'));
router.use('/appointments', require('./appointment.routes'));
router.use('/audit-logs', require('./audit.routes'));

module.exports = router;
