const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

/**
 * Verifies the Bearer access token and sets req.user.
 * Access tokens are short lived (default 15m) and stateless, so a request
 * costs no database round trip; deactivating a user takes effect when their
 * refresh token is next used.
 */
module.exports = (req, res, next) => {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(ApiError.unauthorized('Authentication required'));

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    req.user = { id: payload.sub, role: payload.role, name: payload.name, doctorId: payload.doctorId };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('Access token expired', { code: 'TOKEN_EXPIRED' }));
    }
    return next(ApiError.unauthorized('Invalid access token'));
  }
};
