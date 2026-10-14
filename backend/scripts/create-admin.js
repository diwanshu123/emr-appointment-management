/**
 * Creates the FIRST Super Admin in any environment (including production),
 * where the demo seed is intentionally disabled.
 *   ADMIN_NAME="Jane" ADMIN_EMAIL=jane@clinic.com ADMIN_PASSWORD='S3cure-pass' node scripts/create-admin.js
 */
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const User = require('../src/models/User');
const { ROLES } = require('../src/utils/constants');

async function run() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD');
  if (ADMIN_PASSWORD.length < 8 || !/[A-Za-z]/.test(ADMIN_PASSWORD) || !/\d/.test(ADMIN_PASSWORD)) {
    throw new Error('Password needs 8+ characters with at least one letter and one number');
  }
  await mongoose.connect(env.MONGO_URI);
  await User.init();
  if (await User.exists({ email: ADMIN_EMAIL.toLowerCase() })) throw new Error('A user with this email already exists');
  await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    role: ROLES.SUPER_ADMIN,
    passwordHash: await bcrypt.hash(ADMIN_PASSWORD, env.BCRYPT_ROUNDS),
  });
  console.log(`Super Admin created: ${ADMIN_EMAIL}`);
}

run()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
