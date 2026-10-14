const { Schema, model } = require('mongoose');

/** Atomic sequence generator (used for human friendly patient ids). */
const counterSchema = new Schema({ _id: { type: String }, seq: { type: Number, default: 0 } });

module.exports = model('Counter', counterSchema);
