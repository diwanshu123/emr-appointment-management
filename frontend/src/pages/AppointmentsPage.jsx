import { memo, useCallback, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { appointmentApi, departmentApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import useDebounce from '../hooks/useDebounce';
import useAppointmentMutation from '../hooks/useAppointmentMutation';
import { formatDate, formatTime, todayStr } from '../utils/date';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';

const INITIAL_FILTERS = {
  patient: '', mobile: '', doctorName: '', departmentId: '', status: '', dateFrom: '', dateTo: '', sortBy: 'date', sortOrder: 'asc',
};
const PAGE_SIZE = 10;

const cleanParams = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null));

/* ----------------------------- row actions ----------------------------- */

const AppointmentRow = memo(function AppointmentRow({ a, role, today, busy, onArrive, onComplete, onCancel, onEdit }) {
  const isDoctor = role === 'DOCTOR';
  const canArrive = !isDoctor && a.status === 'SCHEDULED' && a.date === today;
  const canCancel = !isDoctor && ['SCHEDULED', 'ARRIVED'].includes(a.status);
  const canComplete = role !== 'RECEPTIONIST' && a.status === 'ARRIVED';
  const canEdit = isDoctor ? ['ARRIVED', 'COMPLETED'].includes(a.status) : ['SCHEDULED', 'ARRIVED'].includes(a.status);

  return (
    <tr>
      <td>
        <strong>{formatDate(a.date)}</strong>
        <div className="muted">{formatTime(a.startTime)}</div>
      </td>
      <td>
        {a.patientName}
        <div className="muted">{a.patientCode} · {a.patientMobile}</div>
      </td>
      {!isDoctor && (
        <td>
          {a.doctorName}
          <div className="muted">{a.departmentName}</div>
        </td>
      )}
      <td>
        {a.purpose}
        {a.notes && <div className="muted">{a.notes}</div>}
      </td>
      <td><StatusBadge status={a.status} /></td>
      <td>
        <div className="actions">
          {canArrive && <button type="button" className="btn btn-small" disabled={busy} onClick={() => onArrive(a._id)}>Arrived</button>}
          {canComplete && <button type="button" className="btn btn-small" disabled={busy} onClick={() => onComplete(a._id)}>Complete</button>}
          {canEdit && <button type="button" className="btn btn-small" onClick={() => onEdit(a)}>{isDoctor ? 'Notes' : 'Edit'}</button>}
          {canCancel && <button type="button" className="btn btn-small btn-danger" onClick={() => onCancel(a)}>Cancel</button>}
        </div>
      </td>
    </tr>
  );
});

/* ------------------------------- modals ------------------------------- */

function EditModal({ appointment, role, onClose }) {
  const isDoctor = role === 'DOCTOR';
  const [purpose, setPurpose] = useState(appointment.purpose);
  const [notes, setNotes] = useState(appointment.notes || '');
  const [consultationNotes, setConsultationNotes] = useState(appointment.consultationNotes || '');
  const [error, setError] = useState('');

  const mutation = useAppointmentMutation((body) => appointmentApi.update(appointment._id, body), 'Appointment updated', { onDone: onClose });

  const submit = (e) => {
    e.preventDefault();
    if (!isDoctor && purpose.trim().length < 2) return setError('Purpose is required');
    setError('');
    mutation.mutate(isDoctor ? { consultationNotes } : { purpose: purpose.trim(), notes: notes.trim() });
    return undefined;
  };

  return (
    <Modal title={isDoctor ? 'Consultation notes' : 'Edit appointment'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <p className="muted">{appointment.patientName} · {formatDate(appointment.date)} {formatTime(appointment.startTime)}</p>
        {isDoctor ? (
          <div className="field">
            <label htmlFor="cn">Consultation notes</label>
            <textarea id="cn" rows={6} maxLength={5000} value={consultationNotes} onChange={(e) => setConsultationNotes(e.target.value)} />
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="purpose">Purpose</label>
              <input id="purpose" maxLength={200} value={purpose} onChange={(e) => setPurpose(e.target.value)} aria-invalid={Boolean(error)} />
              {error && <small className="error-text" role="alert">{error}</small>}
            </div>
            <div className="field">
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </>
        )}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Close</button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function CancelModal({ appointment, onClose }) {
  const [reason, setReason] = useState('');
  const mutation = useAppointmentMutation((r) => appointmentApi.cancel(appointment._id, r), 'Appointment cancelled', { onDone: onClose });

  return (
    <Modal title="Cancel appointment" onClose={onClose}>
      <p>Cancel <strong>{appointment.patientName}</strong>’s appointment on {formatDate(appointment.date)} at {formatTime(appointment.startTime)}? The slot will become available again.</p>
      <div className="field">
        <label htmlFor="reason">Reason (optional)</label>
        <textarea id="reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose}>Keep appointment</button>
        <button type="button" className="btn btn-danger" disabled={mutation.isPending} onClick={() => mutation.mutate(reason.trim())}>
          {mutation.isPending ? 'Cancelling…' : 'Cancel appointment'}
        </button>
      </div>
    </Modal>
  );
}

/* -------------------------------- page -------------------------------- */

export default function AppointmentsPage() {
  const { user } = useAuth();
  const isDoctor = user.role === 'DOCTOR';
  const today = todayStr();

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  // Typing is debounced so we send one request when the user pauses, not one per key.
  const debounced = useDebounce(filters, 400);
  const params = useMemo(() => cleanParams({ ...debounced, page, limit: PAGE_SIZE }), [debounced, page]);

  const departments = useQuery({ queryKey: ['departments'], queryFn: departmentApi.list, staleTime: 5 * 60_000, enabled: !isDoctor });
  const list = useQuery({
    queryKey: ['appointments', params],
    queryFn: () => appointmentApi.list(params),
    placeholderData: keepPreviousData, // keep the old rows visible while the next page loads
  });

  const setFilter = (key) => (e) => {
    const value = key === 'mobile' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value;
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const arrive = useAppointmentMutation((id) => appointmentApi.arrive(id), 'Patient marked as arrived');
  const complete = useAppointmentMutation((id) => appointmentApi.complete(id), 'Appointment completed');

  const onArrive = useCallback((id) => arrive.mutate(id), [arrive.mutate]); // eslint-disable-line react-hooks/exhaustive-deps
  const onComplete = useCallback((id) => complete.mutate(id), [complete.mutate]); // eslint-disable-line react-hooks/exhaustive-deps
  const onEdit = useCallback((a) => setEditing(a), []);
  const onCancel = useCallback((a) => setCancelling(a), []);

  const rows = list.data?.data ?? [];
  const busy = arrive.isPending || complete.isPending;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{isDoctor ? 'My Appointments' : 'Appointments'}</h1>
          <p className="muted">Search, filter and manage appointments.</p>
        </div>
      </div>

      <div className="card">
        <div className="filters">
          <div className="field"><label htmlFor="f-patient">Patient (name or ID)</label><input id="f-patient" value={filters.patient} onChange={setFilter('patient')} /></div>
          <div className="field"><label htmlFor="f-mobile">Mobile</label><input id="f-mobile" inputMode="numeric" value={filters.mobile} onChange={setFilter('mobile')} /></div>
          {!isDoctor && (
            <>
              <div className="field"><label htmlFor="f-doctor">Doctor</label><input id="f-doctor" value={filters.doctorName} onChange={setFilter('doctorName')} /></div>
              <div className="field">
                <label htmlFor="f-dept">Department</label>
                <select id="f-dept" value={filters.departmentId} onChange={setFilter('departmentId')}>
                  <option value="">All</option>
                  {departments.data?.data.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
            </>
          )}
          <div className="field">
            <label htmlFor="f-status">Status</label>
            <select id="f-status" value={filters.status} onChange={setFilter('status')}>
              <option value="">All</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="ARRIVED">Arrived</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="field"><label htmlFor="f-from">From date</label><input id="f-from" type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={setFilter('dateFrom')} /></div>
          <div className="field"><label htmlFor="f-to">To date</label><input id="f-to" type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={setFilter('dateTo')} /></div>
          <div className="field">
            <label htmlFor="f-sort">Sort by</label>
            <select id="f-sort" value={`${filters.sortBy}:${filters.sortOrder}`} onChange={(e) => { const [sortBy, sortOrder] = e.target.value.split(':'); setFilters((f) => ({ ...f, sortBy, sortOrder })); setPage(1); }}>
              <option value="date:asc">Date (earliest first)</option>
              <option value="date:desc">Date (latest first)</option>
              <option value="patientName:asc">Patient A–Z</option>
              {!isDoctor && <option value="doctorName:asc">Doctor A–Z</option>}
              <option value="createdAt:desc">Recently booked</option>
              <option value="status:asc">Status</option>
            </select>
          </div>
          <div className="field"><label>&nbsp;</label><button type="button" className="btn" onClick={() => { setFilters(INITIAL_FILTERS); setPage(1); }}>Reset filters</button></div>
        </div>
      </div>

      <div className="card">
        <ErrorMessage error={list.error} onRetry={list.refetch} />
        {list.isLoading ? (
          <Spinner label="Loading appointments…" />
        ) : (
          <div className={`table-wrap ${list.isPlaceholderData ? 'dim' : ''}`}>
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Patient</th>
                  {!isDoctor && <th>Doctor</th>}
                  <th>Purpose</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={isDoctor ? 5 : 6} className="muted">No appointments match these filters.</td></tr>
                )}
                {rows.map((a) => (
                  <AppointmentRow key={a._id} a={a} role={user.role} today={today} busy={busy} onArrive={onArrive} onComplete={onComplete} onEdit={onEdit} onCancel={onCancel} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination meta={list.data?.meta} onPageChange={setPage} />
      </div>

      {editing && <EditModal appointment={editing} role={user.role} onClose={() => setEditing(null)} />}
      {cancelling && <CancelModal appointment={cancelling} onClose={() => setCancelling(null)} />}
    </>
  );
}
