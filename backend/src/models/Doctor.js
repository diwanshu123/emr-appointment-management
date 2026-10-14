const { Schema, model } = require('mongoose');
const { HHMM } = require('../utils/time');

const timeField = { type: String, required: true, match: HHMM };

const blockSchema = new Schema(
  { name: { type: String, required: true, trim: true, maxlength: 50 }, startTime: timeField, endTime: timeField },
  { _id: false }
);

const daySchema = new Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 }, // 0 = Sunday
    sessions: { type: [blockSchema], default: [] },
    breaks: { type: [blockSchema], default: [] },
  },
  { _id: false }
);

/**
 * Doctor profile. Login identity lives in User; this holds clinical/scheduling
 * data. Only the *rules* for slots are stored (never the slots themselves):
 * slots are derived on demand, so schedule changes never leave stale rows.
 */
const doctorSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    specialization: { type: String, trim: true, maxlength: 100 },
    slotDurationMinutes: { type: Number, required: true, min: 5, max: 120, default: 15 },
    weeklySchedule: { type: [daySchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

doctorSchema.index({ department: 1, isActive: 1 });

module.exports = model('Doctor', doctorSchema);
