const { Schema, model } = require('mongoose');

const patientSchema = new Schema(
  {
    patientId: { type: String, required: true, unique: true }, // e.g. P-000042
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    searchName: { type: String, required: true }, // lowercase copy -> index friendly prefix search
    mobile: { type: String, required: true },
    gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'], required: true },
    dateOfBirth: { type: String }, // YYYY-MM-DD
    email: { type: String, lowercase: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

patientSchema.pre('validate', function setSearchName(next) {
  if (this.name) this.searchName = this.name.toLowerCase();
  next();
});

patientSchema.index({ mobile: 1 });
patientSchema.index({ searchName: 1 });

module.exports = model('Patient', patientSchema);
