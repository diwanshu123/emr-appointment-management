const { Schema, model } = require('mongoose');
const { APPOINTMENT_STATUS } = require('../utils/constants');
const { HHMM } = require('../utils/time');

const appointmentSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: true },

    date: { type: String, required: true }, // YYYY-MM-DD (clinic timezone)
    startTime: { type: String, required: true, match: HHMM },
    endTime: { type: String, required: true, match: HHMM },

    status: { type: String, enum: Object.values(APPOINTMENT_STATUS), default: APPOINTMENT_STATUS.SCHEDULED },
    /**
     * true while the appointment OCCUPIES its slot. Set to false on cancel,
     * which frees the slot for rebooking while keeping the cancelled record
     * for history/audit. It is what the unique index below is keyed on.
     */
    isActive: { type: Boolean, default: true },

    purpose: { type: String, required: true, trim: true, maxlength: 200 },
    notes: { type: String, trim: true, maxlength: 1000 },
    consultationNotes: { type: String, trim: true, maxlength: 5000 },

    arrivedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancelReason: { type: String, trim: true, maxlength: 300 },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // Denormalised snapshot: lets the list API search/filter/sort with ONE
    // indexed query instead of $lookup joins across 3 collections.
    patientName: String,
    patientNameLower: String,
    patientMobile: String,
    patientCode: String,
    doctorName: String,
    doctorNameLower: String,
    departmentName: String,
  },
  { timestamps: true }
);

/**
 * DOUBLE BOOKING GUARD.
 * Only ONE active appointment may exist per (doctor, date, startTime). The
 * database enforces this atomically, so two simultaneous requests can never
 * both succeed: the second insert fails with E11000 -> HTTP 409.
 * Cancelled appointments (isActive=false) are excluded so the slot is reusable.
 */
appointmentSchema.index(
  { doctor: 1, date: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { isActive: true }, name: 'uniq_active_slot' }
);

// List / scheduler queries
appointmentSchema.index({ date: 1, startTime: 1 });
appointmentSchema.index({ department: 1, date: 1 });
appointmentSchema.index({ status: 1, date: 1 });
appointmentSchema.index({ patientMobile: 1 });
appointmentSchema.index({ patientNameLower: 1 });
appointmentSchema.index({ doctorNameLower: 1 });

module.exports = model('Appointment', appointmentSchema);
