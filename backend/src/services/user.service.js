const bcrypt = require('bcrypt');
const env = require('../config/env');
const User = require('../models/User');
const Department = require('../models/Department');
const ApiError = require('../utils/ApiError');
const { ROLES, AUDIT_ACTIONS } = require('../utils/constants');
const audit = require('./audit.service');

async function createUser({ name, email, password, role }) {
  if (await User.exists({ email })) throw ApiError.conflict('A user with this email already exists');
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  return User.create({ name, email, passwordHash, role });
}

async function createReceptionist(input, actor, meta) {
  const user = await createUser({ ...input, role: ROLES.RECEPTIONIST });
  audit.record({
    actor,
    action: AUDIT_ACTIONS.RECEPTIONIST_CREATED,
    entity: 'User',
    entityId: user._id,
    ip: meta.ip,
  });
  return user.toJSON();
}

async function createDepartment({ name }) {
  if (await Department.exists({ name })) throw ApiError.conflict('Department already exists');
  return Department.create({ name });
}

const listDepartments = () => Department.find({ isActive: true }).sort({ name: 1 }).lean();

module.exports = { createUser, createReceptionist, createDepartment, listDepartments };
