const { z } = require('zod');
const { objectId, dateString, timeString, pagination } = require('./common');
const { newPatientSchema } = require('./patient.validator');
const { APPOINTMENT_STATUS } = require('../utils/constants');

const createBody = z
  .object({
    doctorId: objectId,
    date: dateString,
    startTime: timeString,
    purpose: z.string().trim().min(2).max(200),
    notes: z.string().trim().max(1000).optional(),
    patientId: objectId.optional(), // existing patient
    newPatient: newPatientSchema.optional(), // or create one on the fly
  })
  .strict()
  .refine((b) => Boolean(b.patientId) !== Boolean(b.newPatient), {
    message: 'Provide either patientId (existing patient) or newPatient (new patient), not both',
    path: ['patientId'],
  });

const updateBody = z
  .object({
    purpose: z.string().trim().min(2).max(200),
    notes: z.string().trim().max(1000),
    consultationNotes: z.string().trim().max(5000),
  })
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'Provide at least one field to update' });

const cancelBody = z.object({ reason: z.string().trim().max(300).optional() }).strict().default({});

const SORT_FIELDS = ['date', 'createdAt', 'status', 'patientName', 'doctorName'];

const listQuery = z
  .object({
    ...pagination,
    sortBy: z.enum(SORT_FIELDS).default('date'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    patient: z.string().trim().max(100).optional(), // patient name (prefix) or patient id like P-000012
    mobile: z.string().trim().regex(/^\d{1,10}$/, 'Mobile search must be digits only').optional(),
    doctorName: z.string().trim().max(100).optional(),
    doctorId: objectId.optional(),
    departmentId: objectId.optional(),
    status: z.enum(Object.values(APPOINTMENT_STATUS)).optional(),
    dateFrom: dateString.optional(),
    dateTo: dateString.optional(),
  })
  .refine((q) => !q.dateFrom || !q.dateTo || q.dateFrom <= q.dateTo, {
    message: 'dateFrom must be on or before dateTo',
    path: ['dateFrom'],
  });

module.exports = { createBody, updateBody, cancelBody, listQuery, SORT_FIELDS };
