const { z } = require('zod');
const { objectId, timeString, password, pagination } = require('./common');
const { validateDaySchedule } = require('../utils/slotGenerator');

const blockSchema = z
  .object({ name: z.string().trim().min(1).max(50), startTime: timeString, endTime: timeString })
  .strict();

const daySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    sessions: z.array(blockSchema).min(1).max(6),
    breaks: z.array(blockSchema).max(6).default([]),
  })
  .strict();

const weeklySchedule = z
  .array(daySchema)
  .min(1)
  .max(7)
  .superRefine((days, ctx) => {
    const seen = new Set();
    days.forEach((day, i) => {
      if (seen.has(day.dayOfWeek)) {
        ctx.addIssue({ code: 'custom', path: [i, 'dayOfWeek'], message: 'Duplicate day in schedule' });
      }
      seen.add(day.dayOfWeek);
      validateDaySchedule(day).forEach((message) => ctx.addIssue({ code: 'custom', path: [i], message }));
    });
  });

const slotDurationMinutes = z.number().int().min(5).max(120);

const createDoctorBody = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(254),
    password,
    departmentId: objectId,
    specialization: z.string().trim().max(100).optional(),
    slotDurationMinutes: slotDurationMinutes.default(15),
    weeklySchedule: weeklySchedule.default([]),
  })
  .strict();

const updateScheduleBody = z.object({ slotDurationMinutes, weeklySchedule }).strict();

const listDoctorsQuery = z.object({
  ...pagination,
  departmentId: objectId.optional(),
  search: z.string().trim().max(100).optional(),
});

module.exports = { createDoctorBody, updateScheduleBody, listDoctorsQuery };
