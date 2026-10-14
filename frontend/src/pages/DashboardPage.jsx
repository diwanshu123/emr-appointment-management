import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { appointmentApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatTime, todayStr } from '../utils/date';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';

const STAT_ITEMS = [
  ['total', 'Total today'],
  ['SCHEDULED', 'Scheduled'],
  ['ARRIVED', 'Arrived'],
  ['COMPLETED', 'Completed'],
  ['CANCELLED', 'Cancelled'],
];

export default function DashboardPage() {
  const { user } = useAuth();
  const today = todayStr();
  const isDoctor = user.role === 'DOCTOR';

  // Counters come from ONE aggregation query; the list is a small, paginated query.
  const stats = useQuery({ queryKey: ['dashboard', 'stats', today], queryFn: () => appointmentApi.stats({ date: today }) });
  const queue = useQuery({
    queryKey: ['dashboard', 'queue', today],
    queryFn: () => appointmentApi.list({ dateFrom: today, dateTo: today, limit: 10, sortBy: 'date', sortOrder: 'asc' }),
  });

  const counts = stats.data?.data;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Welcome, {user.name}</h1>
          <p className="muted">{formatDate(today)}</p>
        </div>
        {!isDoctor && <Link to="/scheduler" className="btn btn-primary">+ Book appointment</Link>}
      </div>

      <ErrorMessage error={stats.error} onRetry={stats.refetch} />
      {stats.isLoading ? (
        <Spinner label="Loading statistics…" />
      ) : (
        counts && (
          <div className="stats">
            {STAT_ITEMS.map(([key, label]) => (
              <div className="stat" key={key}>
                <strong>{key === 'total' ? counts.total : counts.byStatus[key]}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )
      )}

      <section className="card">
        <div className="card-head">
          <h2>{isDoctor ? 'My appointments today' : 'Today’s appointments'}</h2>
          <Link to="/appointments">View all</Link>
        </div>
        <ErrorMessage error={queue.error} onRetry={queue.refetch} />
        {queue.isLoading ? (
          <Spinner />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>Patient</th>{!isDoctor && <th>Doctor</th>}<th>Purpose</th><th>Status</th></tr>
              </thead>
              <tbody>
                {queue.data?.data.length === 0 && <tr><td colSpan={isDoctor ? 4 : 5} className="muted">No appointments today.</td></tr>}
                {queue.data?.data.map((a) => (
                  <tr key={a._id}>
                    <td>{formatTime(a.startTime)}</td>
                    <td>{a.patientName}<div className="muted">{a.patientMobile}</div></td>
                    {!isDoctor && <td>{a.doctorName}</td>}
                    <td>{a.purpose}</td>
                    <td><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
