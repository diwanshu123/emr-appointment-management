const patientService = require('../services/patient.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

exports.search = asyncHandler(async (req, res) => {
  ok(res, 'Patients fetched successfully', await patientService.search(req.validated.query.q));
});

exports.get = asyncHandler(async (req, res) => {
  ok(res, 'Patient fetched successfully', await patientService.getById(req.validated.params.id, req.user));
});
