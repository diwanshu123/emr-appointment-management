const { z } = require('zod');
const { dateString } = require('./common');

// Indian 10 digit mobile number (assumption documented in README).
const mobile = z.string().trim().regex(/^[6-9]\d{9}$/, 'Mobile must be a valid 10 digit number');

const newPatientSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    mobile,
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    dateOfBirth: dateString.optional(),
    email: z.string().trim().toLowerCase().email().max(254).optional(),
  })
  .strict();

const searchPatientsQuery = z.object({ q: z.string().trim().min(2, 'Type at least 2 characters').max(100) });

module.exports = { newPatientSchema, searchPatientsQuery };
