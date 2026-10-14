const { ZodError } = require('zod');
const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  let status = 500;
  let message = 'Something went wrong. Please try again later.';
  let errors;
  let code;

  if (err instanceof ApiError) {
    ({ statusCode: status, message, errors, code } = err);
  } else if (err instanceof ZodError) {
    status = 422;
    message = 'Validation failed';
    errors = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 422;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = 'Invalid identifier';
  } else if (err.code === 11000) {
    status = 409;
    message = 'A record with the same unique value already exists';
  } else if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired';
  } else if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  }

  // Only unexpected errors are logged with detail; clients never see internals.
  if (status >= 500) {
    logger.error('Unhandled error', { path: req.originalUrl, method: req.method, error: err.message, stack: err.stack });
  }

  res.status(status).json({
    success: false,
    message,
    ...(code && { code }),
    ...(errors && { errors }),
  });
};
