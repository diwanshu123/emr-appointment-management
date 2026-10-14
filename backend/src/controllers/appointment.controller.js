const appointmentService = require('../services/appointment.service');
const asyncHandler = require('../utils/asyncHandler');
const requestMeta = require('../utils/requestMeta');
const { ok, created } = require('../utils/response');

exports.create = asyncHandler(async (req, res) => {
  const appt = await appointmentService.create(req.validated.body, req.user, requestMeta(req));
  created(res, 'Appointment created successfully', appt);
});

exports.list = asyncHandler(async (req, res) => {
  const { items, meta } = await appointmentService.list(req.validated.query, req.user);
  ok(res, 'Appointments fetched successfully', items, meta);
});

exports.get = asyncHandler(async (req, res) => {
  ok(res, 'Appointment fetched successfully', await appointmentService.getOne(req.validated.params.id, req.user));
});

exports.update = asyncHandler(async (req, res) => {
  const appt = await appointmentService.update(req.validated.params.id, req.validated.body, req.user, requestMeta(req));
  ok(res, 'Appointment updated successfully', appt);
});

exports.cancel = asyncHandler(async (req, res) => {
  const appt = await appointmentService.cancel(req.validated.params.id, req.validated.body, req.user, requestMeta(req));
  ok(res, 'Appointment cancelled successfully', appt);
});

exports.arrive = asyncHandler(async (req, res) => {
  const appt = await appointmentService.markArrived(req.validated.params.id, req.user, requestMeta(req));
  ok(res, 'Patient marked as arrived', appt);
});

exports.complete = asyncHandler(async (req, res) => {
  const appt = await appointmentService.complete(req.validated.params.id, req.user, requestMeta(req));
  ok(res, 'Appointment marked as completed', appt);
});
