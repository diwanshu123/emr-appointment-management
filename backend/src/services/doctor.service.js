const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Department = require('../models/Department');
const ApiError = require('../utils/ApiError');
const { ROLES, AUDIT_ACTIONS } = require('../utils/constants');
const { buildPageMeta, escapeRegex } = require('../utils/pagination');
const userService = require('./user.service');
const audit = require('./audit.service');

const populateDoctor = (query) => query.populate('user', 'name email isActive').populate('department', 'name');

async function createDoctor(input, actor, meta) {
  const { name, email, password, departmentId, specialization, slotDurationMinutes, weeklySchedule } = input;

  if (!(await Department.exists({ _id: departmentId, isActive: true }))) {
    throw ApiError.notFound('Department not found');
  }

  const user = await userService.createUser({ name, email, password, role: ROLES.DOCTOR });
  try {
    const doctor = await Doctor.create({
      user: user._id,
      department: departmentId,
      specialization,
      slotDurationMinutes,
      weeklySchedule,
    });
    audit.record({ actor, action: AUDIT_ACTIONS.DOCTOR_CREATED, entity: 'Doctor', entityId: doctor._id, ip: meta.ip });
    return populateDoctor(Doctor.findById(doctor._id)).lean();
  } catch (err) {
    // No multi-document transaction (keeps the app runnable on a standalone
    // MongoDB), so compensate manually: never leave an orphan login behind.
    await User.deleteOne({ _id: user._id });
    throw err;
  }
}

async function listDoctors({ page, limit, departmentId, search }, actor) {
  const filter = { isActive: true };
  if (departmentId) filter.department = departmentId;
  if (actor.role === ROLES.DOCTOR) filter._id = actor.doctorId;

  if (search) {
    const users = await User.find({ role: ROLES.DOCTOR, name: new RegExp(escapeRegex(search), 'i') })
      .select('_id')
      .lean();
    filter.user = { $in: users.map((u) => u._id) };
  }

  const [items, total] = await Promise.all([
    populateDoctor(Doctor.find(filter))
      .sort({ _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Doctor.countDocuments(filter),
  ]);
  return { items, meta: buildPageMeta({ page, limit, total }) };
}

async function getDoctor(id) {
  const doctor = await populateDoctor(Doctor.findById(id)).lean();
  if (!doctor) throw ApiError.notFound('Doctor not found');
  return doctor;
}

async function updateSchedule(id, { slotDurationMinutes, weeklySchedule }, actor, meta) {
  const doctor = await populateDoctor(
    Doctor.findByIdAndUpdate(id, { $set: { slotDurationMinutes, weeklySchedule } }, { new: true, runValidators: true })
  ).lean();
  if (!doctor) throw ApiError.notFound('Doctor not found');

  audit.record({
    actor,
    action: AUDIT_ACTIONS.SCHEDULE_UPDATED,
    entity: 'Doctor',
    entityId: id,
    metadata: { slotDurationMinutes, workingDays: weeklySchedule.map((d) => d.dayOfWeek) },
    ip: meta.ip,
  });
  return doctor;
}

module.exports = { createDoctor, listDoctors, getDoctor, updateSchedule };
