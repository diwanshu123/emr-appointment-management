import { memo, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { departmentApi, doctorApi, slotApi } from '../api/endpoints';
import { addDays, formatDate, todayStr } from '../utils/date';
import Calendar from '../components/Calendar';
import SlotGrid from '../components/SlotGrid';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';

const DoctorCard = memo(function DoctorCard({ doctor, onSelect }) {
  const handleSelect = useCallback((slot) => onSelect(doctor, slot), [doctor, onSelect]);
  return (
    <section className="card">
      <div className="card-head">
        <h2>{doctor.doctorName}</h2>
        <span className="muted">{doctor.isWorkingDay ? `${doctor.slotDurationMinutes} min slots` : 'Not working on this day'}</span>
      </div>
      {doctor.isWorkingDay && <SlotGrid slots={doctor.slots} onSelect={handleSelect} />}
    </section>
  );
});

export default function SchedulerPage() {
  const navigate = useNavigate();
  const today = todayStr();
  const [departmentId, setDepartmentId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(today);

  const departments = useQuery({ queryKey: ['departments'], queryFn: departmentApi.list, staleTime: 5 * 60_000 });
  const departmentList = departments.data?.data;

  // Pick the first department once, so the scheduler is useful immediately.
  useEffect(() => {
    if (!departmentId && departmentList?.length) setDepartmentId(departmentList[0]._id);
  }, [departmentList, departmentId]);

  const doctors = useQuery({
    queryKey: ['doctors', { departmentId }],
    queryFn: () => doctorApi.list({ departmentId, limit: 100 }),
    enabled: Boolean(departmentId),
    staleTime: 60_000,
  });

  const slotParams = doctorId ? { date, doctorId } : { date, departmentId };
  const slots = useQuery({
    queryKey: ['slots', slotParams],
    queryFn: () => slotApi.list(slotParams),
    enabled: Boolean(doctorId || departmentId),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000, // slots turn "past" as the clock moves
  });

  const handleSelect = useCallback(
    (doctor, slot) => navigate(`/book?${new URLSearchParams({ doctorId: doctor.doctorId, date, time: slot.startTime })}`),
    [navigate, date]
  );

  const onDepartmentChange = (e) => {
    setDepartmentId(e.target.value);
    setDoctorId('');
  };

  const result = slots.data?.data;
  const meta = slots.data?.meta;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Appointment Scheduler</h1>
          <p className="muted">Pick a department, doctor and date, then choose a free slot to book.</p>
        </div>
      </div>

      <div className="scheduler-layout">
        <aside>
          <div className="card">
            <div className="field">
              <label htmlFor="dept">Department</label>
              <select id="dept" value={departmentId} onChange={onDepartmentChange}>
                {departmentList?.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="doc">Doctor</label>
              <select id="doc" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                <option value="">All doctors in department</option>
                {doctors.data?.data.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.user.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="card">
            <Calendar value={date} onChange={setDate} minDate={today} />
            <div className="date-nav">
              <button type="button" className="btn btn-small" disabled={date <= today} onClick={() => setDate(addDays(date, -1))}>
                ‹ Prev day
              </button>
              <button type="button" className="btn btn-small" onClick={() => setDate(today)}>
                Today
              </button>
              <button type="button" className="btn btn-small" onClick={() => setDate(addDays(date, 1))}>
                Next day ›
              </button>
            </div>
          </div>
        </aside>

        <section>
          <div className="card">
            <strong>{formatDate(date)}</strong>
            {meta && (
              <span className="muted">
                {' '}
                · {meta.available} available · {meta.booked} booked
              </span>
            )}
            <div className="legend" style={{ marginTop: '0.6rem' }}>
              <span><i className="i-available" />Available</span>
              <span><i className="i-booked" />Booked</span>
              <span><i className="i-past" />Past</span>
            </div>
          </div>

          <ErrorMessage error={slots.error || departments.error} onRetry={slots.refetch} />
          {slots.isLoading && <Spinner label="Loading slots…" />}
          {result?.doctors.length === 0 && <div className="card muted">No active doctors found.</div>}
          {result?.doctors.map((doctor) => (
            <DoctorCard key={doctor.doctorId} doctor={doctor} onSelect={handleSelect} />
          ))}
        </section>
      </div>
    </>
  );
}
