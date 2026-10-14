const { z } = require('zod');
const { HHMM, isValidDate } = require('../utils/time');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const dateString = z.string().refine(isValidDate, 'Date must be a valid YYYY-MM-DD');
const timeString = z.string().regex(HHMM, 'Time must be HH:mm (24 hour)');
const idParams = z.object({ id: objectId });

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters') // bcrypt ignores bytes after 72
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

module.exports = { objectId, dateString, timeString, idParams, password, pagination };
