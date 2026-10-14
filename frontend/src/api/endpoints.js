import api from './client';

const unwrap = (promise) => promise.then((res) => res.data); // { success, message, data, meta }

export const authApi = {
  login: (email, password) => unwrap(api.post('/auth/login', { email, password })),
  logout: () => unwrap(api.post('/auth/logout')),
};

export const departmentApi = { list: () => unwrap(api.get('/departments')) };

export const doctorApi = {
  list: (params) => unwrap(api.get('/doctors', { params })),
  get: (id) => unwrap(api.get(`/doctors/${id}`)),
  create: (body) => unwrap(api.post('/doctors', body)),
  updateSchedule: (id, body) => unwrap(api.put(`/doctors/${id}/schedule`, body)),
};

export const userApi = { createReceptionist: (body) => unwrap(api.post('/users/receptionists', body)) };

export const slotApi = { list: (params) => unwrap(api.get('/slots', { params })) };

export const patientApi = { search: (q) => unwrap(api.get('/patients', { params: { q } })) };

export const appointmentApi = {
  list: (params) => unwrap(api.get('/appointments', { params })),
  stats: (params) => unwrap(api.get('/appointments/stats', { params })),
  create: (body) => unwrap(api.post('/appointments', body)),
  update: (id, body) => unwrap(api.put(`/appointments/${id}`, body)),
  cancel: (id, reason) => unwrap(api.delete(`/appointments/${id}`, { data: reason ? { reason } : {} })),
  arrive: (id) => unwrap(api.post(`/appointments/${id}/arrive`)),
  complete: (id) => unwrap(api.post(`/appointments/${id}/complete`)),
};
