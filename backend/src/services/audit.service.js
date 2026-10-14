const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');
const { buildPageMeta } = require('../utils/pagination');

/**
 * Fire-and-forget: an audit write must never fail or slow down the business
 * request. The returned promise never rejects, so callers may ignore it.
 */
async function record({ actor, action, entity, entityId, metadata, ip }) {
  try {
    await AuditLog.create({
      user: actor?.id,
      role: actor?.role,
      action,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      metadata,
      ip,
    });
  } catch (err) {
    logger.error('Audit log write failed', { action, error: err.message });
  }
}

async function list({ page, limit, action, entity, userId, dateFrom, dateTo }) {
  const filter = {};
  if (action) filter.action = action;
  if (entity) filter.entity = entity;
  if (userId) filter.user = userId;
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo) filter.createdAt.$lte = new Date(`${dateTo}T23:59:59.999Z`);
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email')
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, meta: buildPageMeta({ page, limit, total }) };
}

module.exports = { record, list };
