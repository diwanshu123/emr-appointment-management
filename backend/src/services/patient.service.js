const Patient = require('../models/Patient');
const Counter = require('../models/Counter');
const Appointment = require('../models/Appointment');
const ApiError = require('../utils/ApiError');
const { ROLES, AUDIT_ACTIONS } = require('../utils/constants');
const { escapeRegex } = require('../utils/pagination');
const audit = require('./audit.service');

const PATIENT_ID_PATTERN = /^P-\d+$/i;

async function nextPatientId() {
  // $inc on a single document is atomic, so concurrent registrations never get the same id.
  const counter = await Counter.findOneAndUpdate(
    { _id: 'patient' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  ).lean();
  return `P-${String(counter.seq).padStart(6, '0')}`;
}

async function create(input, actor, ip) {
  const patient = await Patient.create({ ...input, patientId: await nextPatientId(), createdBy: actor.id });
  audit.record({ actor, action: AUDIT_ACTIONS.PATIENT_CREATED, entity: 'Patient', entityId: patient._id, ip });
  return patient.toObject();
}

/** Search by patient id, mobile number or name. All branches are index backed prefix lookups. */
async function search(q) {
  const term = q.trim();
  let filter;
  if (PATIENT_ID_PATTERN.test(term)) filter = { patientId: term.toUpperCase() };
  else if (/^\d+$/.test(term)) filter = { mobile: new RegExp(`^${escapeRegex(term)}`) };
  else filter = { searchName: new RegExp(`^${escapeRegex(term.toLowerCase())}`) };

  return Patient.find(filter).sort({ searchName: 1 }).limit(20).lean();
}

async function getById(id, actor) {
  const patient = await Patient.findById(id).lean();
  if (!patient) throw ApiError.notFound('Patient not found');

  // A doctor may only view patients they actually have an appointment with.
  if (actor?.role === ROLES.DOCTOR) {
    const hasRelationship = await Appointment.exists({ patient: id, doctor: actor.doctorId });
    if (!hasRelationship) throw ApiError.notFound('Patient not found');
  }
  return patient;
}

module.exports = { create, search, getById };
