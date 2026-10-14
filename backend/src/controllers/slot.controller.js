const slotService = require('../services/slot.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

exports.list = asyncHandler(async (req, res) => {
  const { data, meta } = await slotService.getSlots(req.validated.query);
  ok(res, 'Slots fetched successfully', data, meta);
});
