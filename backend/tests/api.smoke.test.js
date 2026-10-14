/**
 * HTTP-level tests for everything that happens BEFORE the database is touched:
 * authentication, RBAC, validation and the error envelope. No MongoDB needed.
 */
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/unused';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const Appointment = require('../src/models/Appointment');

let server;
let base;
const ID = '64b7f0f2a1b2c3d4e5f60718';

const token = (role, extra = {}) =>
  jwt.sign({ role, name: 'T', ...extra }, process.env.JWT_ACCESS_SECRET, { subject: ID, expiresIn: '5m' });

const call = async (method, path, { auth, body } = {}) => {
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth && { Authorization: `Bearer ${auth}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
};

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

test('protected routes reject missing and invalid tokens with 401', async () => {
  assert.equal((await call('GET', '/appointments')).status, 401);
  assert.equal((await call('GET', '/appointments', { auth: 'garbage' })).status, 401);
  const expired = jwt.sign({ role: 'DOCTOR' }, process.env.JWT_ACCESS_SECRET, { subject: ID, expiresIn: -10 });
  const res = await call('GET', '/appointments', { auth: expired });
  assert.equal(res.status, 401);
  assert.equal(res.json.code, 'TOKEN_EXPIRED');
});

test('RBAC: receptionist cannot create doctors or read audit logs', async () => {
  const auth = token('RECEPTIONIST');
  assert.equal((await call('POST', '/doctors', { auth, body: {} })).status, 403);
  assert.equal((await call('GET', '/audit-logs', { auth })).status, 403);
  assert.equal((await call('PUT', `/doctors/${ID}/schedule`, { auth, body: {} })).status, 403);
});

test('RBAC: doctor cannot book, cancel, or mark arrived; cannot use slots API', async () => {
  const auth = token('DOCTOR', { doctorId: ID });
  assert.equal((await call('POST', '/appointments', { auth, body: {} })).status, 403);
  assert.equal((await call('DELETE', `/appointments/${ID}`, { auth })).status, 403);
  assert.equal((await call('POST', `/appointments/${ID}/arrive`, { auth })).status, 403);
  assert.equal((await call('GET', `/slots?date=2030-01-07&doctorId=${ID}`, { auth })).status, 403);
});

test('RBAC: receptionist cannot complete appointments', async () => {
  assert.equal((await call('POST', `/appointments/${ID}/complete`, { auth: token('RECEPTIONIST') })).status, 403);
});

test('validation errors return 422 with a consistent envelope', async () => {
  const res = await call('POST', '/appointments', { auth: token('RECEPTIONIST'), body: { doctorId: 'x' } });
  assert.equal(res.status, 422);
  assert.equal(res.json.success, false);
  assert.ok(Array.isArray(res.json.errors) && res.json.errors.length > 0);
});

test('login validates input before touching the database', async () => {
  assert.equal((await call('POST', '/auth/login', { body: { email: 'nope' } })).status, 422);
});

test('slots query requires a date and a doctor or department', async () => {
  const auth = token('RECEPTIONIST');
  assert.equal((await call('GET', '/slots', { auth })).status, 422);
  assert.equal((await call('GET', '/slots?date=2030-01-07', { auth })).status, 422);
});

test('unknown routes return a clean 404 and malformed JSON a 400', async () => {
  assert.equal((await call('GET', '/nope')).status, 404);
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json',
  });
  assert.equal(res.status, 400);
});

test('DB level double-booking guard is a UNIQUE PARTIAL index on active appointments', () => {
  const idx = Appointment.schema.indexes().find(([, opts]) => opts.name === 'uniq_active_slot');
  assert.ok(idx, 'uniq_active_slot index must be defined');
  assert.deepEqual(idx[0], { doctor: 1, date: 1, startTime: 1 });
  assert.equal(idx[1].unique, true);
  assert.deepEqual(idx[1].partialFilterExpression, { isActive: true });
});
