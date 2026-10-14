const fmt = (level, msg, meta) =>
  JSON.stringify({ level, time: new Date().toISOString(), msg, ...(meta || {}) });

module.exports = {
  info: (msg, meta) => console.log(fmt('info', msg, meta)),
  warn: (msg, meta) => console.warn(fmt('warn', msg, meta)),
  error: (msg, meta) => console.error(fmt('error', msg, meta)),
};
