export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const block = (name, startTime, endTime) => ({ name, startTime, endTime });

export const emptyDays = () =>
  DAY_NAMES.map((label, dayOfWeek) => ({ dayOfWeek, label, enabled: false, sessions: [], breaks: [] }));

/** Mon-Sat, 09:00-12:00 + 13:00-17:00 with a 12:00-13:00 lunch break (the example from the brief). */
export const standardDays = () =>
  emptyDays().map((d) =>
    d.dayOfWeek === 0
      ? d
      : {
          ...d,
          enabled: true,
          sessions: [block('Morning Session', '09:00', '12:00'), block('Evening Session', '13:00', '17:00')],
          breaks: [block('Lunch Break', '12:00', '13:00')],
        }
  );

export const fromApi = (weeklySchedule = []) =>
  emptyDays().map((d) => {
    const found = weeklySchedule.find((w) => w.dayOfWeek === d.dayOfWeek);
    return found ? { ...d, enabled: true, sessions: found.sessions, breaks: found.breaks || [] } : d;
  });

export const toPayload = (days) =>
  days
    .filter((d) => d.enabled)
    .map(({ dayOfWeek, sessions, breaks }) => ({
      dayOfWeek,
      sessions: sessions.map(({ name, startTime, endTime }) => ({ name: name.trim(), startTime, endTime })),
      breaks: breaks.map(({ name, startTime, endTime }) => ({ name: name.trim(), startTime, endTime })),
    }));

export const newBlock = (kind) => block(kind === 'session' ? 'Session' : 'Break', '09:00', '10:00');

export const summarize = (weeklySchedule = []) =>
  weeklySchedule.length === 0
    ? 'No working days'
    : weeklySchedule.map((d) => DAY_NAMES[d.dayOfWeek].slice(0, 3)).join(', ');
