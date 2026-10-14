const { Schema, model } = require('mongoose');

const departmentSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = model('Department', departmentSchema);
