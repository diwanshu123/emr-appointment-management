/** Small helper so controllers/services receive client info consistently. */
module.exports = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });
