const ApiError = require('../utils/ApiError');

/** RBAC guard. Usage: router.post('/', authenticate, authorize(ROLES.SUPER_ADMIN), handler) */
module.exports =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized('Authentication required'));
    if (!allowedRoles.includes(req.user.role)) return next(ApiError.forbidden());
    return next();
  };
