const { toMinutes, toHHmm } = require('./time');

const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

/**
 * Pure function: builds the slots for ONE working day.
 *  - walks every session in `slotDuration` steps
 *  - a slot must fit completely inside its session
 *  - a slot that touches any break period is dropped
 *  - slots can never overlap (defensive guard on top of schedule validation)
 *
 * @param {{sessions: {startTime:string,endTime:string}[], breaks?: {startTime:string,endTime:string}[]}|null} day
 * @param {number} slotDuration minutes
 * @returns {{startTime:string,endTime:string}[]}
 */
function generateSlots(day, slotDuration) {
  if (!day || !(slotDuration > 0)) return [];

  const breaks = (day.breaks || []).map((b) => [toMinutes(b.startTime), toMinutes(b.endTime)]);
  const sessions = (day.sessions || [])
    .map((s) => [toMinutes(s.startTime), toMinutes(s.endTime)])
    .sort((a, b) => a[0] - b[0]);

  const slots = [];
  let lastEnd = -1;

  for (const [sessionStart, sessionEnd] of sessions) {
    for (let start = sessionStart; start + slotDuration <= sessionEnd; start += slotDuration) {
      const end = start + slotDuration;
      if (start < lastEnd) continue;
      if (breaks.some(([bs, be]) => overlaps(start, end, bs, be))) continue;
      slots.push({ startTime: toHHmm(start), endTime: toHHmm(end) });
      lastEnd = end;
    }
  }
  return slots;
}

/** Returns a list of human readable problems for one day's schedule. */
function validateDaySchedule(day) {
  const errors = [];
  const check = (list, label) =>
    list.forEach((item) => {
      if (toMinutes(item.startTime) >= toMinutes(item.endTime)) {
        errors.push(`${label} "${item.name}" must end after it starts`);
      }
    });

  check(day.sessions || [], 'Session');
  check(day.breaks || [], 'Break');

  const sorted = [...(day.sessions || [])].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  for (let i = 1; i < sorted.length; i += 1) {
    if (toMinutes(sorted[i].startTime) < toMinutes(sorted[i - 1].endTime)) {
      errors.push(`Sessions "${sorted[i - 1].name}" and "${sorted[i].name}" overlap`);
    }
  }
  return errors;
}

module.exports = { generateSlots, validateDaySchedule };
