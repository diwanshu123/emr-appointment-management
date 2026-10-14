const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/departments', require('./department.routes'));
router.use('/doctors', require('./doctor.routes'));
router.use('/slots', require('./slot.routes'));

module.exports = router;
