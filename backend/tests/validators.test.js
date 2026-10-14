const test = require('node:test');
const assert = require('node:assert/strict');
const { createBody, listQuery, updateBody } = require('../src/validators/appointment.validator');
const { createDoctorBody } = require('../src/validators/doctor.validator');

const ID = '64b7f0f2a1b2c3d4e5f60718';
const base = { doctorId: ID, date: '2030-01-07', startTime: '09:15', purpose: 'Fever' };
const patient = { name: 'Asha Verma', mobile: '9876543210', gender: 'FEMALE' };

test('booking needs exactly one of patientId / newPatient', () => {
  assert.ok(createBody.safeParse({ ...base, patientId: ID }).success);
  assert.ok(createBody.safeParse({ ...base, newPatient: patient }).success);
  assert.ok(!createBody.safeParse(base).success);
  assert.ok(!createBody.safeParse({ ...base, patientId: ID, newPatient: patient }).success);
});

test('booking rejects bad dates, times and unknown fields', () => {
  assert.ok(!createBody.safeParse({ ...base, patientId: ID, date: '2030-02-31' }).success);
  assert.ok(!createBody.safeParse({ ...base, patientId: ID, startTime: '9:15' }).success);
  assert.ok(!createBody.safeParse({ ...base, patientId: ID, status: 'COMPLETED' }).success);
});

test('NoSQL operator objects are rejected (injection protection)', () => {
  assert.ok(!createBody.safeParse({ ...base, patientId: { $ne: null } }).success);
  assert.ok(!listQuery.safeParse({ status: { $ne: 'CANCELLED' } }).success);
});

test('list query applies defaults, coerces numbers and caps the page size', () => {
  const q = listQuery.parse({ page: '2', limit: '10' });
  assert.deepEqual([q.page, q.limit, q.sortBy, q.sortOrder], [2, 10, 'date', 'asc']);
  assert.ok(!listQuery.safeParse({ limit: '1000' }).success);
  assert.ok(!listQuery.safeParse({ sortBy: 'passwordHash' }).success);
  assert.ok(!listQuery.safeParse({ dateFrom: '2030-02-01', dateTo: '2030-01-01' }).success);
});

test('update requires at least one field', () => {
  assert.ok(!updateBody.safeParse({}).success);
  assert.ok(updateBody.safeParse({ notes: 'Bring reports' }).success);
});

test('doctor schedule: rejects overlapping sessions and duplicate days', () => {
  const doctor = {
    name: 'Dr Test',
    email: 'dr@test.com',
    password: 'Secret123',
    departmentId: ID,
    weeklySchedule: [
      {
        dayOfWeek: 1,
        sessions: [
          { name: 'A', startTime: '09:00', endTime: '12:00' },
          { name: 'B', startTime: '11:00', endTime: '14:00' },
        ],
      },
    ],
  };
  assert.ok(!createDoctorBody.safeParse(doctor).success);

  const ok = { ...doctor, weeklySchedule: [{ dayOfWeek: 1, sessions: [{ name: 'A', startTime: '09:00', endTime: '12:00' }] }] };
  assert.ok(createDoctorBody.safeParse(ok).success);

  const dup = { ...ok, weeklySchedule: [ok.weeklySchedule[0], ok.weeklySchedule[0]] };
  assert.ok(!createDoctorBody.safeParse(dup).success);
});

test('weak passwords are rejected', () => {
  const doc = { name: 'Dr Test', email: 'dr@test.com', departmentId: ID };
  assert.ok(!createDoctorBody.safeParse({ ...doc, password: 'short1' }).success);
  assert.ok(!createDoctorBody.safeParse({ ...doc, password: 'onlyletters' }).success);
});
