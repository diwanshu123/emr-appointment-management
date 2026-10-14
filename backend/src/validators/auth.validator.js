const { z } = require('zod');

const loginBody = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(72),
  })
  .strict();

const refreshBody = z.object({ refreshToken: z.string().min(1).optional() }).strict().default({});

module.exports = { loginBody, refreshBody };
