/**
 * Seeds demo data (idempotent: safe to run many times).
 * Usage: npm run seed
 * Never runs in production.
 */
require('../src/config/env');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const User = require('../src/models/User');
const Doctor = require('../src/models/Doctor');
const Department = require('../src/models/Department');
const { ROLES } = require('../src/utils/constants');

const PASSWORD = process.env.SEED_PASSWORD || 'Admin@12345';

const workingDay = (dayOfWeek) => ({
  dayOfWeek,
  sessions: [
    { name: 'Morning Session', startTime: '09:00', endTime: '12:00' },
    { name: 'Evening Session', startTime: '13:00', endTime: '17:00' },
  ],
  breaks: [{ name: 'Lunch Break', startTime: '12:00', endTime: '13:00' }],
});

const monToSat = [1, 2, 3, 4, 5, 6].map(workingDay);

async function upsertUser({ name, email, role }) {
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({ name, email, role, passwordHash: await bcrypt.hash(PASSWORD, env.BCRYPT_ROUNDS) });
}

async function upsertDepartment(name) {
  return (await Department.findOne({ name })) || Department.create({ name });
}

async function upsertDoctor({ name, email, department, specialization, slotDurationMinutes }) {
  const user = await upsertUser({ name, email, role: ROLES.DOCTOR });
  const existing = await Doctor.findOne({ user: user._id });
  if (existing) return existing;
  return Doctor.create({ user: user._id, department: department._id, specialization, slotDurationMinutes, weeklySchedule: monToSat });
}

async function run() {
  if (env.isProd) throw new Error('Refusing to seed demo data in production');
  await mongoose.connect(env.MONGO_URI);
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

  await upsertUser({ name: 'Super Admin', email: 'admin@emr.local', role: ROLES.SUPER_ADMIN });
  await upsertUser({ name: 'Riya Receptionist', email: 'reception@emr.local', role: ROLES.RECEPTIONIST });

  const general = await upsertDepartment('General Medicine');
  const cardiology = await upsertDepartment('Cardiology');

  await upsertDoctor({ name: 'Dr. Anil Sharma', email: 'anil.sharma@emr.local', department: general, specialization: 'Physician', slotDurationMinutes: 15 });
  await upsertDoctor({ name: 'Dr. Meera Iyer', email: 'meera.iyer@emr.local', department: cardiology, specialization: 'Cardiologist', slotDurationMinutes: 30 });

  console.log('Seed complete. Demo logins (password for all: %s)', PASSWORD);
  console.log('  Super Admin  : admin@emr.local');
  console.log('  Receptionist : reception@emr.local');
  console.log('  Doctor       : anil.sharma@emr.local / meera.iyer@emr.local');
}

run()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
