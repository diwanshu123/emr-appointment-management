const auditService = require('../services/audit.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

exports.list = asyncHandler(async (req, res) => {
  const { items, meta } = await auditService.list(req.validated.query);
  ok(res, 'Audit logs fetched successfully', items, meta);
});
