/**
 * Proves the double-booking guarantee against a RUNNING API.
 *   1. npm run seed && npm run dev          (in another terminal)
 *   2. node scripts/concurrency-check.js
 * It logs in as the receptionist, finds one free slot, and fires N booking
 * requests for that same slot AT THE SAME TIME. Expected: exactly 1 x 201 and
 * N-1 x 409. Anything else is a bug.
 */
const API = process.env.API_URL || 'http://localhost:5000/api/v1';
const PARALLEL = Number(process.env.PARALLEL || 15);
const EMAIL = process.env.CHECK_EMAIL || 'reception@emr.local';
const PASSWORD = process.env.SEED_PASSWORD || 'Admin@12345';

const call = async (method, path, token, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
};

const addDays = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function main() {
  const login = await call('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD });
  if (login.status !== 200) throw new Error(`Login failed (${login.status}): ${login.json.message}`);
  const token = login.json.data.accessToken;

  const doctors = (await call('GET', '/doctors?limit=1', token)).json.data;
  if (!doctors.length) throw new Error('No doctors found. Run: npm run seed');
  const doctorId = doctors[0]._id;

  // find the first AVAILABLE slot within the next 14 days
  let target;
  for (let i = 1; i <= 14 && !target; i += 1) {
    const date = addDays(new Date().toISOString().slice(0, 10), i);
    const slots = (await call('GET', `/slots?doctorId=${doctorId}&date=${date}`, token)).json.data.doctors[0].slots;
    const free = slots.find((s) => s.status === 'AVAILABLE');
    if (free) target = { date, startTime: free.startTime };
  }
  if (!target) throw new Error('No free slot found in the next 14 days');
  console.log(`Target slot: ${target.date} ${target.startTime} — firing ${PARALLEL} simultaneous bookings…`);

  const stamp = Date.now().toString().slice(-6);
  const requests = Array.from({ length: PARALLEL }, (_, i) =>
    call('POST', '/appointments', token, {
      doctorId,
      date: target.date,
      startTime: target.startTime,
      purpose: `Concurrency test ${i}`,
      newPatient: { name: `Race Tester ${i}`, mobile: `9${stamp}${String(i).padStart(3, '0')}`, gender: 'OTHER' },
    })
  );
  const results = await Promise.all(requests);

  const tally = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
  console.log('Status codes:', tally);

  const ok = tally[201] === 1 && tally[409] === PARALLEL - 1;
  console.log(ok ? 'PASS: exactly one booking succeeded.' : 'FAIL: unexpected result — investigate!');
  process.exitCode = ok ? 0 : 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
