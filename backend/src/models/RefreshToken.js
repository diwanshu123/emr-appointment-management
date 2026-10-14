const { Schema, model } = require('mongoose');

const refreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jti: { type: String, required: true, unique: true },
    tokenHash: { type: String, required: true }, // sha256 of the token; raw token is never stored
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    userAgent: String,
    ip: String,
  },
  { timestamps: true }
);

// MongoDB removes expired rows automatically.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = model('RefreshToken', refreshTokenSchema);
