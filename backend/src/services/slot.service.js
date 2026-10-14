const env = require('../config/env');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const ApiError = require('../utils/ApiError');
const { SLOT_STATUS } = require('../utils/constants');
const { generateSlots } = require('../utils/slotGenerator');
const { dayOfWeek, getClinicNow, isSlotInPast } = require('../utils/time');

const getDaySchedule = (doctor, date) =>
  doctor.weeklySchedule.find((d) => d.dayOfWeek === dayOfWeek(date)) || null;

/** The single source of truth for "is this a real slot for this doctor on this date". */
const findSlot = (doctor, date, startTime) =>
  generateSlots(getDaySchedule(doctor, date), doctor.slotDurationMinutes).find((s) => s.startTime === startTime) || null;

async function getSlots({ doctorId, departmentId, date }) {
  const filter = { isActive: true, ...(doctorId ? { _id: doctorId } : { department: departmentId }) };
  const doctors = await Doctor.find(filter).populate('user', 'name').lean();
  if (doctorId && doctors.length === 0) throw ApiError.notFound('Doctor not found');

  // ONE query for all booked slots of all requested doctors (no N+1).
  const booked = await Appointment.find({ doctor: { $in: doctors.map((d) => d._id) }, date, isActive: true })
    .select('doctor startTime status patientName')
    .lean();
  const bookedBySlot = new Map(booked.map((a) => [`${a.doctor}|${a.startTime}`, a]));

  const now = getClinicNow(env.CLINIC_TIMEZONE);

  const result = doctors.map((doctor) => {
    const day = getDaySchedule(doctor, date);
    const slots = generateSlots(day, doctor.slotDurationMinutes).map((slot) => {
      const appointment = bookedBySlot.get(`${doctor._id}|${slot.startTime}`);
      let status = SLOT_STATUS.AVAILABLE;
      if (appointment) status = SLOT_STATUS.BOOKED;
      else if (isSlotInPast(date, slot.startTime, now)) status = SLOT_STATUS.PAST;
      return {
        ...slot,
        status,
        ...(appointment && {
          appointmentId: appointment._id,
          appointmentStatus: appointment.status,
          patientName: appointment.patientName,
        }),
      };
    });
    return {
      doctorId: doctor._id,
      doctorName: doctor.user?.name,
      departmentId: doctor.department,
      slotDurationMinutes: doctor.slotDurationMinutes,
      isWorkingDay: Boolean(day),
      slots,
    };
  });

  const all = result.flatMap((d) => d.slots);
  return {
    data: { date, doctors: result },
    meta: {
      total: all.length,
      available: all.filter((s) => s.status === SLOT_STATUS.AVAILABLE).length,
      booked: all.filter((s) => s.status === SLOT_STATUS.BOOKED).length,
    },
  };
}

module.exports = { getSlots, findSlot, getDaySchedule };
