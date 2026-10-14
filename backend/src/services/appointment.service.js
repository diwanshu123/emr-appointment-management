const mongoose = require('mongoose');
const env = require('../config/env');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const ApiError = require('../utils/ApiError');
const { ROLES, APPOINTMENT_STATUS: STATUS, STATUS_TRANSITIONS, AUDIT_ACTIONS } = require('../utils/constants');
const { buildPageMeta, escapeRegex } = require('../utils/pagination');
const { getClinicNow, isSlotInPast } = require('../utils/time');
const slotService = require('./slot.service');
const patientService = require('./patient.service');
const audit = require('./audit.service');
const realtime = require('../sockets/realtime');

const OPEN_STATUSES = [STATUS.SCHEDULED, STATUS.ARRIVED];

/* ------------------------------ helpers ------------------------------ */

const toEvent = (appt, action) => ({
  action,
  appointmentId: appt._id,
  doctorId: appt.doctor,
  departmentId: appt.department,
  date: appt.date,
  startTime: appt.startTime,
  endTime: appt.endTime,
  status: appt.status,
  updatedAt: appt.updatedAt,
});

const publish = (eventName, appt, action) => realtime.emitAppointmentEvent(eventName, toEvent(appt, action));

/** Loads an appointment the actor is allowed to see. Doctors only see their own (404, not 403, so ids can't be probed). */
async function getAccessible(id, actor) {
  const appt = await Appointment.findById(id).lean();
  if (!appt || (actor.role === ROLES.DOCTOR && String(appt.doctor) !== actor.doctorId)) {
    throw ApiError.notFound('Appointment not found');
  }
  return appt;
}

/**
 * Atomic status change. The status check lives INSIDE the update filter, so a
 * concurrent cancel/arrive/complete can never be silently overwritten.
 */
async function transition(id, to, extraSet, actor) {
  const from = Object.keys(STATUS_TRANSITIONS).filter((s) => STATUS_TRANSITIONS[s].includes(to));
  const updated = await Appointment.findOneAndUpdate(
    { _id: id, status: { $in: from } },
    { $set: { status: to, updatedBy: actor.id, ...extraSet } },
    { new: true }
  ).lean();
  if (updated) return updated;

  const existing = await Appointment.findById(id).select('status').lean();
  if (!existing) throw ApiError.notFound('Appointment not found');
  throw ApiError.conflict(`Cannot change an appointment from ${existing.status} to ${to}`);
}

/* ------------------------------- create ------------------------------- */

async function create(input, actor, meta) {
  const doctor = await Doctor.findOne({ _id: input.doctorId, isActive: true })
    .populate('user', 'name')
    .populate('department', 'name')
    .lean();
  if (!doctor) throw ApiError.notFound('Doctor not found');

  const now = getClinicNow(env.CLINIC_TIMEZONE);
  if (input.date < now.date) throw ApiError.badRequest('Cannot book an appointment on a past date');

  // Re-derive the slot on the server: the client's time is never trusted.
  const slot = slotService.findSlot(doctor, input.date, input.startTime);
  if (!slot) {
    throw ApiError.badRequest(
      'Selected time is not a bookable slot for this doctor (non-working day, outside session hours, or during a break)'
    );
  }
  if (isSlotInPast(input.date, slot.startTime, now)) {
    throw ApiError.badRequest('Cannot book a time slot that has already passed');
  }

  let patient;
  let patientCreated = false;
  if (input.patientId) {
    patient = await patientService.getById(input.patientId);
  } else {
    patient = await patientService.create(input.newPatient, actor, meta.ip);
    patientCreated = true;
  }

  let appointment;
  try {
    appointment = (
      await Appointment.create({
        patient: patient._id,
        doctor: doctor._id,
        department: doctor.department._id,
        date: input.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        purpose: input.purpose,
        notes: input.notes,
        createdBy: actor.id,
        patientName: patient.name,
        patientNameLower: patient.searchName,
        patientMobile: patient.mobile,
        patientCode: patient.patientId,
        doctorName: doctor.user.name,
        doctorNameLower: doctor.user.name.toLowerCase(),
        departmentName: doctor.department.name,
      })
    ).toObject();
  } catch (err) {
    if (patientCreated) await Patient.deleteOne({ _id: patient._id }).catch(() => {});
    // The unique partial index rejected a second booking of the same slot.
    if (err.code === 11000) {
      throw ApiError.conflict('This slot has just been booked by someone else. Please choose another slot.');
    }
    throw err;
  }

  audit.record({
    actor,
    action: AUDIT_ACTIONS.APPOINTMENT_CREATED,
    entity: 'Appointment',
    entityId: appointment._id,
    metadata: { doctorId: doctor._id, date: appointment.date, startTime: appointment.startTime },
    ip: meta.ip,
  });
  publish('appointment:created', appointment, 'created');
  return appointment;
}

/* -------------------------------- read -------------------------------- */

function buildListFilter(q, actor) {
  const filter = {};

  // Doctors are ALWAYS scoped to themselves, whatever the query says.
  if (actor.role === ROLES.DOCTOR) filter.doctor = actor.doctorId;
  else if (q.doctorId) filter.doctor = q.doctorId;

  if (q.departmentId) filter.department = q.departmentId;
  if (q.status) filter.status = q.status;

  if (q.dateFrom || q.dateTo) {
    filter.date = {};
    if (q.dateFrom) filter.date.$gte = q.dateFrom;
    if (q.dateTo) filter.date.$lte = q.dateTo;
  }

  if (q.patient) {
    if (/^P-\d+$/i.test(q.patient)) filter.patientCode = q.patient.toUpperCase();
    else filter.patientNameLower = new RegExp(`^${escapeRegex(q.patient.toLowerCase())}`);
  }
  if (q.mobile) filter.patientMobile = new RegExp(`^${escapeRegex(q.mobile)}`);
  if (q.doctorName) filter.doctorNameLower = new RegExp(`^${escapeRegex(q.doctorName.toLowerCase())}`);

  return filter;
}

function buildSort({ sortBy, sortOrder }) {
  const dir = sortOrder === 'desc' ? -1 : 1;
  const sort = {};
  if (sortBy === 'date') {
    sort.date = dir;
    sort.startTime = dir;
  } else if (sortBy === 'patientName') sort.patientNameLower = dir;
  else if (sortBy === 'doctorName') sort.doctorNameLower = dir;
  else sort[sortBy] = dir;
  sort._id = dir; // stable order => pagination never repeats or skips rows
  return sort;
}

async function list(query, actor) {
  const filter = buildListFilter(query, actor);
  // Consultation notes are clinical data: only doctors/admins receive them in lists.
  const projection = actor.role === ROLES.RECEPTIONIST ? '-consultationNotes' : '';

  const [items, total] = await Promise.all([
    Appointment.find(filter, projection)
      .sort(buildSort(query))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Appointment.countDocuments(filter),
  ]);
  return { items, meta: buildPageMeta({ page: query.page, limit: query.limit, total }) };
}

async function getOne(id, actor) {
  const appt = await getAccessible(id, actor);
  if (actor.role === ROLES.RECEPTIONIST) delete appt.consultationNotes;
  return appt;
}

/** Dashboard counters: ONE aggregation, served by the {date, startTime} index. */
async function stats({ date }, actor) {
  const day = date || getClinicNow(env.CLINIC_TIMEZONE).date;
  const match = { date: day };
  if (actor.role === ROLES.DOCTOR) match.doctor = new mongoose.Types.ObjectId(actor.doctorId);

  const rows = await Appointment.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
  const byStatus = Object.fromEntries(Object.values(STATUS).map((s) => [s, 0]));
  rows.forEach((r) => {
    byStatus[r._id] = r.count;
  });
  return { date: day, total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus };
}

/* ------------------------------- update ------------------------------- */

async function update(id, changes, actor, meta) {
  const isDoctor = actor.role === ROLES.DOCTOR;
  const touchesStaffFields = 'purpose' in changes || 'notes' in changes;
  const touchesClinicalFields = 'consultationNotes' in changes;

  if (isDoctor && touchesStaffFields) throw ApiError.forbidden('Doctors can only update consultation notes');
  if (!isDoctor && touchesClinicalFields && actor.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Only doctors can update consultation notes');
  }

  const current = await getAccessible(id, actor);

  // Reception fields can change while the visit is open; consultation notes
  // are written during/after the visit.
  const allowedStatuses = touchesClinicalFields ? [STATUS.ARRIVED, STATUS.COMPLETED] : OPEN_STATUSES;
  if (!allowedStatuses.includes(current.status)) {
    throw ApiError.conflict(`A ${current.status.toLowerCase()} appointment cannot be edited this way`);
  }

  const updated = await Appointment.findOneAndUpdate(
    { _id: id, status: { $in: allowedStatuses } }, // re-checked atomically
    { $set: { ...changes, updatedBy: actor.id } },
    { new: true, runValidators: true }
  ).lean();
  if (!updated) throw ApiError.conflict('Appointment status changed while updating. Please reload and retry.');

  audit.record({
    actor,
    action: AUDIT_ACTIONS.APPOINTMENT_UPDATED,
    entity: 'Appointment',
    entityId: id,
    metadata: { fields: Object.keys(changes) }, // field names only, never clinical content
    ip: meta.ip,
  });
  publish('appointment:updated', updated, 'updated');
  if (actor.role === ROLES.RECEPTIONIST) delete updated.consultationNotes;
  return updated;
}

/* ------------------------- status transitions ------------------------- */

async function cancel(id, { reason }, actor, meta) {
  await getAccessible(id, actor);
  const cancelled = await transition(
    id,
    STATUS.CANCELLED,
    { isActive: false, cancelledAt: new Date(), cancelReason: reason }, // isActive=false frees the slot
    actor
  );
  audit.record({
    actor,
    action: AUDIT_ACTIONS.APPOINTMENT_CANCELLED,
    entity: 'Appointment',
    entityId: id,
    metadata: { reason },
    ip: meta.ip,
  });
  publish('appointment:cancelled', cancelled, 'cancelled');
  return cancelled;
}

async function markArrived(id, actor, meta) {
  const current = await getAccessible(id, actor);
  if (current.date !== getClinicNow(env.CLINIC_TIMEZONE).date) {
    throw ApiError.badRequest('A patient can only be marked as arrived on the day of the appointment');
  }
  const arrived = await transition(id, STATUS.ARRIVED, { arrivedAt: new Date() }, actor);
  audit.record({ actor, action: AUDIT_ACTIONS.APPOINTMENT_ARRIVED, entity: 'Appointment', entityId: id, ip: meta.ip });
  publish('appointment:updated', arrived, 'arrived');
  return arrived;
}

async function complete(id, actor, meta) {
  await getAccessible(id, actor);
  const completed = await transition(id, STATUS.COMPLETED, { completedAt: new Date() }, actor);
  audit.record({ actor, action: AUDIT_ACTIONS.APPOINTMENT_COMPLETED, entity: 'Appointment', entityId: id, ip: meta.ip });
  publish('appointment:updated', completed, 'completed');
  return completed;
}

module.exports = { create, list, getOne, stats, update, cancel, markArrived, complete };
