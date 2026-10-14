const env = require('../config/env');
const authService = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');
const requestMeta = require('../utils/requestMeta');
const { ok } = require('../utils/response');

const COOKIE_NAME = 'refreshToken';

// httpOnly: JavaScript (and therefore XSS) can never read the refresh token.
// path: the browser only sends it to the auth endpoints.
const cookieOptions = (expires) => ({
  httpOnly: true,
  secure: env.isProd || env.COOKIE_SAMESITE === 'none',
  sameSite: env.COOKIE_SAMESITE,
  path: '/api/v1/auth',
  expires,
});

const respondWithSession = (res, message, { user, accessToken, refreshToken, refreshExpiresAt }) => {
  res.cookie(COOKIE_NAME, refreshToken, cookieOptions(refreshExpiresAt));
  return ok(res, message, { user, accessToken });
};

exports.login = asyncHandler(async (req, res) => {
  const session = await authService.login(req.validated.body, requestMeta(req));
  respondWithSession(res, 'Login successful', session);
});

exports.refresh = asyncHandler(async (req, res) => {
  // Cookie is the primary channel; body fallback exists for API clients without cookie support.
  const token = req.cookies[COOKIE_NAME] || req.validated.body.refreshToken;
  const session = await authService.refresh(token, requestMeta(req));
  respondWithSession(res, 'Token refreshed', session);
});

exports.logout = asyncHandler(async (req, res) => {
  const token = req.cookies[COOKIE_NAME] || req.validated.body.refreshToken;
  await authService.logout(token, undefined, req.ip);
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), expires: undefined });
  ok(res, 'Logged out successfully', null);
});

exports.me = asyncHandler(async (req, res) => ok(res, 'Current user', req.user));
