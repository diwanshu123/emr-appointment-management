require('dotenv').config();
const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  CLINIC_TIMEZONE: z.string().default('Asia/Kolkata'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast: a mis-configured server must never start.
  console.error('Invalid environment configuration:');
  parsed.error.issues.forEach((i) => console.error(` - ${i.path.join('.')}: ${i.message}`));
  process.exit(1);
}

const env = parsed.data;
module.exports = Object.freeze({
  ...env,
  isProd: env.NODE_ENV === 'production',
  clientOrigins: env.CLIENT_ORIGIN.split(',').map((o) => o.trim()),
});
