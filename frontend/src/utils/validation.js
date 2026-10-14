import { toMinutes } from './date';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE = /^[6-9]\d{9}$/;

export function validateLogin({ email, password }) {
  const errors = {};
  if (!EMAIL.test(email.trim())) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Password is required';
  return errors;
}

export function validateNewPatient(p) {
  const errors = {};
  if (p.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
  if (!MOBILE.test(p.mobile)) errors.mobile = 'Enter a valid 10 digit mobile number';
  if (!p.gender) errors.gender = 'Select a gender';
  if (p.email && !EMAIL.test(p.email.trim())) errors.email = 'Enter a valid email address';
  return errors;
}

export function validateBooking({ mode, selectedPatient, newPatient, purpose }) {
  let errors = {};
  if (mode === 'existing' && !selectedPatient) errors.patient = 'Search and select a patient';
  if (mode === 'new') errors = { ...errors, ...validateNewPatient(newPatient) };
  if (purpose.trim().length < 2) errors.purpose = 'Please enter the purpose of the visit';
  return errors;
}

export function validateStaffUser({ name, email, password }) {
  const errors = {};
  if (name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
  if (!EMAIL.test(email.trim())) errors.email = 'Enter a valid email address';
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = 'Min 8 characters with at least one letter and one number';
  }
  return errors;
}

/** Mirrors the server rules so the user gets instant feedback. */
export function validateScheduleDays(days) {
  const errors = [];
  const enabled = days.filter((d) => d.enabled);
  if (enabled.length === 0) errors.push('Select at least one working day');
  enabled.forEach((day) => {
    const label = day.label;
    if (day.sessions.length === 0) errors.push(`${label}: add at least one session`);
    const blocks = [...day.sessions.map((s) => ({ ...s, kind: 'Session' })), ...day.breaks.map((b) => ({ ...b, kind: 'Break' }))];
    blocks.forEach((b) => {
      if (!b.name.trim()) errors.push(`${label}: every ${b.kind.toLowerCase()} needs a name`);
      if (!b.startTime || !b.endTime || toMinutes(b.startTime) >= toMinutes(b.endTime)) {
        errors.push(`${label}: ${b.kind.toLowerCase()} "${b.name || '?'}" must end after it starts`);
      }
    });
    const sorted = [...day.sessions].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
    for (let i = 1; i < sorted.length; i += 1) {
      if (toMinutes(sorted[i].startTime) < toMinutes(sorted[i - 1].endTime)) errors.push(`${label}: sessions overlap`);
    }
  });
  return errors;
}
