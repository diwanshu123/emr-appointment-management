const { z } = require('zod');
const { objectId, dateString } = require('./common');

const slotsQuery = z
  .object({
    date: dateString,
    doctorId: objectId.optional(),
    departmentId: objectId.optional(),
  })
  .refine((q) => q.doctorId || q.departmentId, {
    message: 'Provide doctorId or departmentId',
    path: ['doctorId'],
  });

module.exports = { slotsQuery };
