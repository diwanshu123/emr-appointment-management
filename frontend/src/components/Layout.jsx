import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useRealtime from '../hooks/useRealtime';

const ROLE_LABEL = { SUPER_ADMIN: 'Super Admin', RECEPTIONIST: 'Receptionist', DOCTOR: 'Doctor' };

const NAV = [
  { to: '/', label: 'Dashboard', roles: ['SUPER_ADMIN', 'RECEPTIONIST', 'DOCTOR'], end: true },
  { to: '/scheduler', label: 'Scheduler', roles: ['SUPER_ADMIN', 'RECEPTIONIST'] },
  { to: '/appointments', label: 'Appointments', roles: ['SUPER_ADMIN', 'RECEPTIONIST', 'DOCTOR'] },
  { to: '/doctors', label: 'Doctors & Staff', roles: ['SUPER_ADMIN'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { connected, lastUpdate } = useRealtime(Boolean(user));

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <strong className="brand">EMR Appointments</strong>
          <nav className="nav" aria-label="Main">
            {NAV.filter((n) => n.roles.includes(user.role)).map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-user">
            <span
              className={`live ${connected ? 'live-on' : 'live-off'}`}
              title={lastUpdate ? `Last live update ${lastUpdate.toLocaleTimeString()}` : 'Live updates'}
            >
              {connected ? 'Live' : 'Offline'}
            </span>
            <span className="user-name">
              {user.name} <small>({ROLE_LABEL[user.role]})</small>
            </span>
            <button type="button" className="btn btn-small" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
