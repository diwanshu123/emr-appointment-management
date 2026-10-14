import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Spinner from './components/Spinner';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';

// Route-level code splitting: each page is downloaded only when first visited.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SchedulerPage = lazy(() => import('./pages/SchedulerPage'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));
const DoctorsPage = lazy(() => import('./pages/DoctorsPage'));

const STAFF = ['SUPER_ADMIN', 'RECEPTIONIST'];

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="scheduler" element={<ProtectedRoute roles={STAFF}><SchedulerPage /></ProtectedRoute>} />
          <Route path="book" element={<ProtectedRoute roles={STAFF}><BookingPage /></ProtectedRoute>} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="doctors" element={<ProtectedRoute roles={['SUPER_ADMIN']}><DoctorsPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
