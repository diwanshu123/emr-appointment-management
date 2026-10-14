const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const RefreshToken = require('../models/RefreshToken');
const ApiError = require('../utils/ApiError');
const { ROLES, AUDIT_ACTIONS } = require('../utils/constants');
const audit = require('./audit.service');

// Used to spend the same time on "unknown email" as on "wrong password",
// so response timing does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('timing-attack-protection', env.BCRYPT_ROUNDS);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const INVALID_CREDENTIALS = 'Invalid email or password';

async function signAccessToken(user) {
  const claims = { role: user.role, name: user.name };
  if (user.role === ROLES.DOCTOR) {
    // Resolved once at login so doctor-scoped queries need no extra lookup per request.
    const doctor = await Doctor.findOne({ user: user._id }).select('_id').lean();
    if (doctor) claims.doctorId = doctor._id.toString();
  }
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    subject: user._id.toString(),
    expiresIn: env.ACCESS_TOKEN_TTL,
  });
}

async function issueRefreshToken(user, meta) {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const token = jwt.sign({ jti }, env.JWT_REFRESH_SECRET, {
    subject: user._id.toString(),
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`,
  });
  await RefreshToken.create({
    user: user._id,
    jti,
    tokenHash: sha256(token),
    expiresAt,
    userAgent: meta.userAgent,
    ip: meta.ip,
  });
  return { token, expiresAt };
}

async function startSession(user, meta) {
  const [accessToken, refresh] = await Promise.all([signAccessToken(user), issueRefreshToken(user, meta)]);
  return { accessToken, refreshToken: refresh.token, refreshExpiresAt: refresh.expiresAt };
}

async function login({ email, password }, meta) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordOk = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  if (!user || !passwordOk || !user.isActive) {
    audit.record({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entity: 'Auth',
      metadata: { email },
      ip: meta.ip,
    });
    throw ApiError.unauthorized(INVALID_CREDENTIALS);
  }

  const session = await startSession(user, meta);
  audit.record({
    actor: { id: user._id, role: user.role },
    action: AUDIT_ACTIONS.LOGIN,
    entity: 'User',
    entityId: user._id,
    ip: meta.ip,
  });
  return { user: user.toJSON(), ...session };
}

/**
 * Refresh-token ROTATION: every refresh revokes the used token and issues a
 * new one. If an already-revoked token is presented again it means it was
 * stolen/replayed, so ALL sessions of that user are revoked (reuse detection).
 */
async function refresh(token, meta) {
  if (!token) throw ApiError.unauthorized('Refresh token missing');

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const stored = await RefreshToken.findOne({ jti: payload.jti });
  if (!stored || stored.tokenHash !== sha256(token)) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  if (stored.revokedAt) {
    await RefreshToken.updateMany({ user: stored.user, revokedAt: null }, { $set: { revokedAt: new Date() } });
    throw ApiError.unauthorized('Session is no longer valid. Please log in again.');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('Session is no longer valid. Please log in again.');

  // Atomic revoke: if two refresh calls race, only one wins.
  const revoked = await RefreshToken.findOneAndUpdate(
    { _id: stored._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  if (!revoked) throw ApiError.unauthorized('Session is no longer valid. Please log in again.');

  return { user: user.toJSON(), ...(await startSession(user, meta)) };
}

/** Logout invalidates the refresh token server side. Always succeeds (idempotent). */
async function logout(token, actor, ip) {
  if (token) {
    try {
      const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
      await RefreshToken.updateOne({ jti: payload.jti, revokedAt: null }, { $set: { revokedAt: new Date() } });
      audit.record({
        actor: actor || { id: payload.sub },
        action: AUDIT_ACTIONS.LOGOUT,
        entity: 'User',
        entityId: payload.sub,
        ip,
      });
    } catch {
      /* token already invalid/expired: nothing to revoke */
    }
  }
}

module.exports = { login, refresh, logout };
