import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { departmentApi, doctorApi, userApi } from '../api/endpoints';
import { useToast } from '../context/ToastContext';
import { fromApi, standardDays, summarize, toPayload } from '../utils/schedule';
import { validateScheduleDays, validateStaffUser } from '../utils/validation';
import FormField from '../components/FormField';
import ScheduleEditor from '../components/ScheduleEditor';
import ErrorMessage from '../components/ErrorMessage';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';

const EMPTY_USER = { name: '', email: '', password: '' };

/** Shared by "create doctor" and "create receptionist". */
function useStaffMutation(fn, successMessage, onClose) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(successMessage);
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      onClose();
    },
  });
}

function UserFields({ form, setForm, errors }) {
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  return (
    <div className="grid-2">
      <FormField label="Full name *" error={errors.name}>
        {(id, bad) => <input id={id} value={form.name} onChange={set('name')} aria-invalid={bad} />}
      </FormField>
      <FormField label="Email *" error={errors.email}>
        {(id, bad) => <input id={id} type="email" autoComplete="off" value={form.email} onChange={set('email')} aria-invalid={bad} />}
      </FormField>
      <FormField label="Temporary password *" error={errors.password} hint="Min 8 characters, with a letter and a number">
        {(id, bad) => <input id={id} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} aria-invalid={bad} />}
      </FormField>
    </div>
  );
}

function ReceptionistModal({ onClose }) {
  const [form, setForm] = useState(EMPTY_USER);
  const [errors, setErrors] = useState({});
  const mutation = useStaffMutation((body) => userApi.createReceptionist(body), 'Receptionist created', onClose);

  const submit = (e) => {
    e.preventDefault();
    const found = validateStaffUser(form);
    setErrors(found);
    if (Object.keys(found).length === 0) mutation.mutate({ ...form, name: form.name.trim(), email: form.email.trim() });
  };

  return (
    <Modal title="Add receptionist" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <UserFields form={form} setForm={setForm} errors={errors} />
        <ErrorMessage error={mutation.error} />
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </Modal>
  );
}

function DoctorModal({ departments, onClose }) {
  const [form, setForm] = useState(EMPTY_USER);
  const [departmentId, setDepartmentId] = useState(departments[0]?._id || '');
  const [specialization, setSpecialization] = useState('');
  const [slotDuration, setSlotDuration] = useState(15);
  const [days, setDays] = useState(standardDays);
  const [errors, setErrors] = useState({});
  const [scheduleErrors, setScheduleErrors] = useState([]);
  const mutation = useStaffMutation((body) => doctorApi.create(body), 'Doctor created', onClose);

  const submit = (e) => {
    e.preventDefault();
    const found = validateStaffUser(form);
    if (!departmentId) found.department = 'Select a department';
    const sErrors = validateScheduleDays(days);
    setErrors(found);
    setScheduleErrors(sErrors);
    if (Object.keys(found).length > 0 || sErrors.length > 0) return;

    mutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      departmentId,
      ...(specialization.trim() && { specialization: specialization.trim() }),
      slotDurationMinutes: slotDuration,
      weeklySchedule: toPayload(days),
    });
  };

  return (
    <Modal title="Add doctor" onClose={onClose} wide>
      <form onSubmit={submit} noValidate>
        <UserFields form={form} setForm={setForm} errors={errors} />
        <div className="grid-2">
          <FormField label="Department *" error={errors.department}>
            {(id, bad) => (
              <select id={id} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} aria-invalid={bad}>
                {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            )}
          </FormField>
          <FormField label="Specialization">
            {(id) => <input id={id} value={specialization} maxLength={100} onChange={(e) => setSpecialization(e.target.value)} />}
          </FormField>
        </div>
        <h2 style={{ margin: '0.5rem 0' }}>Weekly schedule</h2>
        <ScheduleEditor slotDuration={slotDuration} onSlotDuration={setSlotDuration} days={days} onDays={setDays} />
        {scheduleErrors.length > 0 && <div className="alert alert-error" role="alert"><ul>{scheduleErrors.map((m) => <li key={m}>{m}</li>)}</ul></div>}
        <ErrorMessage error={mutation.error} />
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Creating…' : 'Create doctor'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ScheduleModal({ doctor, onClose }) {
  const [slotDuration, setSlotDuration] = useState(doctor.slotDurationMinutes);
  const [days, setDays] = useState(() => fromApi(doctor.weeklySchedule));
  const [scheduleErrors, setScheduleErrors] = useState([]);
  const mutation = useStaffMutation((body) => doctorApi.updateSchedule(doctor._id, body), 'Schedule updated', onClose);

  const submit = (e) => {
    e.preventDefault();
    const found = validateScheduleDays(days);
    setScheduleErrors(found);
    if (found.length === 0) mutation.mutate({ slotDurationMinutes: slotDuration, weeklySchedule: toPayload(days) });
  };

  return (
    <Modal title={`Schedule — ${doctor.user.name}`} onClose={onClose} wide>
      <form onSubmit={submit} noValidate>
        <div className="alert alert-info">Changes apply to future slot generation. Existing appointments are never deleted.</div>
        <ScheduleEditor slotDuration={slotDuration} onSlotDuration={setSlotDuration} days={days} onDays={setDays} />
        {scheduleErrors.length > 0 && <div className="alert alert-error" role="alert"><ul>{scheduleErrors.map((m) => <li key={m}>{m}</li>)}</ul></div>}
        <ErrorMessage error={mutation.error} />
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save schedule'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function DoctorsPage() {
  const [modal, setModal] = useState(null); // 'doctor' | 'receptionist' | { schedule: doctor }
  const departments = useQuery({ queryKey: ['departments'], queryFn: departmentApi.list, staleTime: 5 * 60_000 });
  const doctors = useQuery({ queryKey: ['doctors', { all: true }], queryFn: () => doctorApi.list({ limit: 100 }) });
  const departmentList = departments.data?.data ?? [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Doctors & Staff</h1>
          <p className="muted">Create doctors and receptionists, and manage doctor schedules.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => setModal('receptionist')}>+ Receptionist</button>
          <button type="button" className="btn btn-primary" disabled={departmentList.length === 0} onClick={() => setModal('doctor')}>+ Doctor</button>
        </div>
      </div>

      <div className="card">
        <ErrorMessage error={doctors.error || departments.error} onRetry={doctors.refetch} />
        {doctors.isLoading ? (
          <Spinner />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Doctor</th><th>Department</th><th>Slot length</th><th>Working days</th><th /></tr></thead>
              <tbody>
                {doctors.data?.data.length === 0 && <tr><td colSpan={5} className="muted">No doctors yet.</td></tr>}
                {doctors.data?.data.map((d) => (
                  <tr key={d._id}>
                    <td>{d.user.name}<div className="muted">{d.user.email}{d.specialization ? ` · ${d.specialization}` : ''}</div></td>
                    <td>{d.department.name}</td>
                    <td>{d.slotDurationMinutes} min</td>
                    <td>{summarize(d.weeklySchedule)}</td>
                    <td><button type="button" className="btn btn-small" onClick={() => setModal({ schedule: d })}>Edit schedule</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal === 'receptionist' && <ReceptionistModal onClose={() => setModal(null)} />}
      {modal === 'doctor' && <DoctorModal departments={departmentList} onClose={() => setModal(null)} />}
      {modal?.schedule && <ScheduleModal doctor={modal.schedule} onClose={() => setModal(null)} />}
    </>
  );
}
