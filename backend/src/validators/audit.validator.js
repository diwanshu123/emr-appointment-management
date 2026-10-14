const { z } = require('zod');
const { objectId, dateString, pagination } = require('./common');
const { AUDIT_ACTIONS } = require('../utils/constants');

const listAuditQuery = z.object({
  ...pagination,
  action: z.enum(Object.values(AUDIT_ACTIONS)).optional(),
  entity: z.string().trim().max(50).optional(),
  userId: objectId.optional(),
  dateFrom: dateString.optional(),
  dateTo: dateString.optional(),
});

module.exports = { listAuditQuery };
