const { z } = require('zod');
const { password } = require('./common');

const createReceptionistBody = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(254),
    password,
  })
  .strict();

const createDepartmentBody = z.object({ name: z.string().trim().min(2).max(100) }).strict();

module.exports = { createReceptionistBody, createDepartmentBody };
