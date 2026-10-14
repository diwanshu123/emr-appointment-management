const userService = require('../services/user.service');
const asyncHandler = require('../utils/asyncHandler');
const requestMeta = require('../utils/requestMeta');
const { ok, created } = require('../utils/response');

exports.createReceptionist = asyncHandler(async (req, res) => {
  const user = await userService.createReceptionist(req.validated.body, req.user, requestMeta(req));
  created(res, 'Receptionist created successfully', user);
});

exports.createDepartment = asyncHandler(async (req, res) => {
  created(res, 'Department created successfully', await userService.createDepartment(req.validated.body));
});

exports.listDepartments = asyncHandler(async (req, res) => {
  ok(res, 'Departments fetched successfully', await userService.listDepartments());
});
