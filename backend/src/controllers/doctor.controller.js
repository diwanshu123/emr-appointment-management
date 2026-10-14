const doctorService = require('../services/doctor.service');
const asyncHandler = require('../utils/asyncHandler');
const requestMeta = require('../utils/requestMeta');
const { ok, created } = require('../utils/response');

exports.create = asyncHandler(async (req, res) => {
  const doctor = await doctorService.createDoctor(req.validated.body, req.user, requestMeta(req));
  created(res, 'Doctor created successfully', doctor);
});

exports.list = asyncHandler(async (req, res) => {
  const { items, meta } = await doctorService.listDoctors(req.validated.query, req.user);
  ok(res, 'Doctors fetched successfully', items, meta);
});

exports.get = asyncHandler(async (req, res) => {
  ok(res, 'Doctor fetched successfully', await doctorService.getDoctor(req.validated.params.id));
});

exports.updateSchedule = asyncHandler(async (req, res) => {
  const doctor = await doctorService.updateSchedule(
    req.validated.params.id,
    req.validated.body,
    req.user,
    requestMeta(req)
  );
  ok(res, 'Doctor schedule updated successfully', doctor);
});
