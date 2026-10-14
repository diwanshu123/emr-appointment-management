const test = require('node:test');
const assert = require('node:assert/strict');
const { generateSlots, validateDaySchedule } = require('../src/utils/slotGenerator');
const { getClinicNow, isSlotInPast, isValidDate, dayOfWeek } = require('../src/utils/time');

const starts = (slots) => slots.map((s) => s.startTime);

test('generates 15 minute slots for a one hour session (spec example)', () => {
  const day = { sessions: [{ name: 'S', startTime: '09:00', endTime: '10:00' }], breaks: [] };
  assert.deepEqual(starts(generateSlots(day, 15)), ['09:00', '09:15', '09:30', '09:45']);
});

test('never generates a slot that ends after the session', () => {
  const day = { sessions: [{ name: 'S', startTime: '09:00', endTime: '10:00' }] };
  const slots = generateSlots(day, 25);
  assert.deepEqual(slots, [
    { startTime: '09:00', endTime: '09:25' },
    { startTime: '09:25', endTime: '09:50' },
  ]);
});

test('no slots are generated inside the lunch break between two sessions', () => {
  const day = {
    sessions: [
      { name: 'Morning', startTime: '09:00', endTime: '12:00' },
      { name: 'Evening', startTime: '13:00', endTime: '17:00' },
    ],
    breaks: [{ name: 'Lunch', startTime: '12:00', endTime: '13:00' }],
  };
  const slots = generateSlots(day, 30);
  assert.equal(slots.length, 6 + 8);
  assert.ok(!starts(slots).includes('12:00'));
  assert.ok(!starts(slots).includes('12:30'));
  assert.equal(starts(slots)[5], '11:30');
  assert.equal(starts(slots)[6], '13:00');
});

test('a break inside a session removes every slot that touches it', () => {
  const day = {
    sessions: [{ name: 'S', startTime: '09:00', endTime: '12:00' }],
    breaks: [{ name: 'Tea', startTime: '10:30', endTime: '11:00' }],
  };
  // 20 minute slots: 10:20-10:40 and 10:40-11:00 both touch the break
  const s = starts(generateSlots(day, 20));
  assert.ok(!s.includes('10:20'));
  assert.ok(!s.includes('10:40'));
  assert.ok(s.includes('10:00'));
  assert.ok(s.includes('11:00'));
});

test('slots never overlap, even when sessions are given out of order', () => {
  const day = {
    sessions: [
      { name: 'B', startTime: '13:00', endTime: '15:00' },
      { name: 'A', startTime: '09:00', endTime: '11:00' },
    ],
  };
  const slots = generateSlots(day, 20);
  for (let i = 1; i < slots.length; i += 1) {
    assert.ok(slots[i].startTime >= slots[i - 1].endTime);
  }
  assert.equal(slots[0].startTime, '09:00');
});

test('non working day (null) yields no slots', () => {
  assert.deepEqual(generateSlots(null, 15), []);
});

test('validateDaySchedule detects reversed and overlapping sessions', () => {
  assert.equal(
    validateDaySchedule({ sessions: [{ name: 'X', startTime: '10:00', endTime: '09:00' }], breaks: [] }).length,
    1
  );
  const overlap = validateDaySchedule({
    sessions: [
      { name: 'A', startTime: '09:00', endTime: '12:00' },
      { name: 'B', startTime: '11:00', endTime: '14:00' },
    ],
  });
  assert.equal(overlap.length, 1);
  assert.match(overlap[0], /overlap/);
});

test('getClinicNow converts UTC to the clinic timezone (IST = UTC+5:30)', () => {
  const now = getClinicNow('Asia/Kolkata', new Date('2026-10-14T20:00:00Z'));
  assert.deepEqual(now, { date: '2026-10-15', minutes: 90 });
});

test('isSlotInPast: earlier day, same day passed, same day future', () => {
  const now = { date: '2026-10-14', minutes: 10 * 60 };
  assert.equal(isSlotInPast('2026-10-13', '16:00', now), true);
  assert.equal(isSlotInPast('2026-10-14', '09:45', now), true);
  assert.equal(isSlotInPast('2026-10-14', '10:00', now), true);
  assert.equal(isSlotInPast('2026-10-14', '10:15', now), false);
  assert.equal(isSlotInPast('2026-10-15', '08:00', now), false);
});

test('date helpers', () => {
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('2026-10-14'), true);
  assert.equal(dayOfWeek('2026-10-14'), 3); // Wednesday
});
