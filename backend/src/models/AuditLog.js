const { Schema, model } = require('mongoose');

const auditLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    role: String,
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: String,
    metadata: Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });

module.exports = model('AuditLog', auditLogSchema);
