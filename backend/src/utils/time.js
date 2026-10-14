/**
 * Time helpers. Dates are plain "YYYY-MM-DD" strings and times are "HH:mm"
 * strings in the CLINIC's timezone. This avoids UTC/DST/off-by-one bugs: a
 * calendar date + wall-clock time is exactly what a clinic schedule is.
 */
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const toHHmm = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const isValidDate = (s) => {
  if (typeof s !== 'string' || !YMD.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** 0 = Sunday ... 6 = Saturday, for a calendar date string. */
const dayOfWeek = (s) => new Date(`${s}T00:00:00Z`).getUTCDay();

/** Current date and minutes-since-midnight in the clinic timezone. */
function getClinicNow(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

/** A slot is "past" once its start time is reached. */
const isSlotInPast = (date, startTime, clinicNow) =>
  date < clinicNow.date || (date === clinicNow.date && toMinutes(startTime) <= clinicNow.minutes);

module.exports = { HHMM, YMD, toMinutes, toHHmm, isValidDate, dayOfWeek, getClinicNow, isSlotInPast };
