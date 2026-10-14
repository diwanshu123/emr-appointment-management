/** Single place that defines the API response envelope. */
const send = (res, statusCode, message, data = null, meta = {}) =>
  res.status(statusCode).json({ success: true, message, data, meta });

module.exports = {
  ok: (res, message, data, meta) => send(res, 200, message, data, meta),
  created: (res, message, data, meta) => send(res, 201, message, data, meta),
};
