const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/auth.controller');
const authenticate = require('../middlewares/authenticate');
const validate = require('../middlewares/validate');
const { loginBody, refreshBody } = require('../validators/auth.validator');

// Brute-force protection on the login endpoint.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

router.post('/login', loginLimiter, validate({ body: loginBody }), controller.login);
router.post('/refresh', validate({ body: refreshBody }), controller.refresh);
router.post('/logout', validate({ body: refreshBody }), controller.logout);
router.get('/me', authenticate, controller.me);

module.exports = router;
