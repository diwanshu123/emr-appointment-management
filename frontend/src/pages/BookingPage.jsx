import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appointmentApi, doctorApi, patientApi } from '../api/endpoints';
import useDebounce from '../hooks/useDebounce';
import { useToast } from '../context/ToastContext';
import { formatDate, formatTime } from '../utils/date';
import { validateBooking } from '../utils/validation';
import FormField from '../components/FormField';
import ErrorMessage from '../components/ErrorMessage';
import Spinner from '../components/Spinner';

const EMPTY_PATIENT = { name: '', mobile: '', gender: '', dateOfBirth: '', email: '' };

export default function BookingPage() {
  const [params] = useSearchParams();
  const doctorId = params.get('doctorId');
  const date = params.get('date');
  const time = params.get('time');
  const hasSlot = Boolean(doctorId && date && time);

  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState('existing');
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [newPatient, setNewPatient] = useState(EMPTY_PATIENT);
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});

  const debouncedSearch = useDebounce(search.trim(), 300);

  const doctor = useQuery({ queryKey: ['doctor', doctorId], queryFn: () => doctorApi.get(doctorId), enabled: hasSlot });
  const patients = useQuery({
    queryKey: ['patients', debouncedSearch],
    queryFn: () => patientApi.search(debouncedSearch),
    enabled: mode === 'existing' && debouncedSearch.length >= 2 && !selectedPatient,
  });

  const booking = useMutation({
    mutationFn: (body) => appointmentApi.create(body),
    onSuccess: () => {
      toast.success('Appointment booked successfully');
      ['appointments', 'slots', 'dashboard'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      navigate('/appointments');
    },
    onError: (err) => {
      // 409 = someone else took the slot a moment ago; make sure the grid is fresh.
      if (err.response?.status === 409) queryClient.invalidateQueries({ queryKey: ['slots'] });
    },
  });

  if (!hasSlot) return <Navigate to="/scheduler" replace />;

  const setPatientField = (key) => (e) => {
    const value = key === 'mobile' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value;
    setNewPatient((p) => ({ ...p, [key]: value }));
  };

  const submit = (e) => {
    e.preventDefault();
    const found = validateBooking({ mode, selectedPatient, newPatient, purpose });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const body = { doctorId, date, startTime: time, purpose: purpose.trim() };
    if (notes.trim()) body.notes = notes.trim();
    if (mode === 'existing') body.patientId = selectedPatient._id;
    else {
      body.newPatient = Object.fromEntries(
        Object.entries(newPatient)
          .map(([k, v]) => [k, v.trim()])
          .filter(([, v]) => v !== '')
      );
    }
    booking.mutate(body);
  };

  const conflict = booking.error?.response?.status === 409;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Book Appointment</h1>
          <Link to="/scheduler">← Back to scheduler</Link>
        </div>
      </div>

      <div className="booking-layout">
        <form className="card" onSubmit={submit} noValidate>
          <div className="tabs" role="group" aria-label="Patient type">
            <button type="button" className="tab" aria-pressed={mode === 'existing'} onClick={() => setMode('existing')}>
              Existing patient
            </button>
            <button type="button" className="tab" aria-pressed={mode === 'new'} onClick={() => setMode('new')}>
              New patient
            </button>
          </div>

          {mode === 'existing' ? (
            <div className="field">
              <label htmlFor="patient-search">Search by patient ID, mobile number or name</label>
              {selectedPatient ? (
                <div className="selected-patient">
                  <span>
                    <strong>{selectedPatient.name}</strong> · {selectedPatient.patientId} · {selectedPatient.mobile}
                  </span>
                  <button type="button" className="btn btn-small" onClick={() => setSelectedPatient(null)}>
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input
                    id="patient-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="e.g. P-000012, 98765…, Asha"
                    aria-invalid={Boolean(errors.patient)}
                    autoComplete="off"
                  />
                  {patients.isFetching && <small className="hint">Searching…</small>}
                  {patients.data?.data.length === 0 && debouncedSearch.length >= 2 && (
                    <small className="hint">No patient found. Use the “New patient” tab to register one.</small>
                  )}
                  {patients.data?.data.length > 0 && (
                    <ul className="result-list">
                      {patients.data.data.map((p) => (
                        <li key={p._id}>
                          <button type="button" onClick={() => setSelectedPatient(p)}>
                            <strong>{p.name}</strong> <span className="muted">· {p.patientId} · {p.mobile}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {errors.patient && <small className="error-text" role="alert">{errors.patient}</small>}
            </div>
          ) : (
            <div className="grid-2">
              <FormField label="Full name *" error={errors.name}>
                {(id, invalid) => <input id={id} value={newPatient.name} onChange={setPatientField('name')} aria-invalid={invalid} />}
              </FormField>
              <FormField label="Mobile number *" error={errors.mobile}>
                {(id, invalid) => <input id={id} inputMode="numeric" value={newPatient.mobile} onChange={setPatientField('mobile')} aria-invalid={invalid} />}
              </FormField>
              <FormField label="Gender *" error={errors.gender}>
                {(id, invalid) => (
                  <select id={id} value={newPatient.gender} onChange={setPatientField('gender')} aria-invalid={invalid}>
                    <option value="">Select…</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                )}
              </FormField>
              <FormField label="Date of birth">
                {(id) => <input id={id} type="date" max={new Date().toISOString().slice(0, 10)} value={newPatient.dateOfBirth} onChange={setPatientField('dateOfBirth')} />}
              </FormField>
              <FormField label="Email" error={errors.email}>
                {(id, invalid) => <input id={id} type="email" value={newPatient.email} onChange={setPatientField('email')} aria-invalid={invalid} />}
              </FormField>
            </div>
          )}

          <FormField label="Purpose of visit *" error={errors.purpose}>
            {(id, invalid) => <input id={id} maxLength={200} value={purpose} onChange={(e) => setPurpose(e.target.value)} aria-invalid={invalid} />}
          </FormField>
          <FormField label="Notes">
            {(id) => <textarea id={id} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />}
          </FormField>

          <ErrorMessage error={booking.error} />
          {conflict && (
            <div className="alert alert-info">
              <span>That slot is no longer free.</span>
              <Link to="/scheduler">Choose another slot</Link>
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={booking.isPending}>
              {booking.isPending ? 'Booking…' : 'Confirm booking'}
            </button>
          </div>
        </form>

        <aside className="card">
          <h2>Appointment summary</h2>
          {doctor.isLoading ? (
            <Spinner label="Loading…" />
          ) : (
            <>
              <div className="summary-row"><span className="muted">Doctor</span><strong>{doctor.data?.data.user.name}</strong></div>
              <div className="summary-row"><span className="muted">Department</span><span>{doctor.data?.data.department.name}</span></div>
              <div className="summary-row"><span className="muted">Date</span><span>{formatDate(date)}</span></div>
              <div className="summary-row"><span className="muted">Time</span><span>{formatTime(time)}</span></div>
            </>
          )}
          <ErrorMessage error={doctor.error} />
        </aside>
      </div>
    </>
  );
}
