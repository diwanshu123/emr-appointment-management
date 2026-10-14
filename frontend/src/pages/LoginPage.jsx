import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/client';
import { validateLogin } from '../utils/validation';
import FormField from '../components/FormField';
import ErrorMessage from '../components/ErrorMessage';

export default function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={location.state?.from || '/'} replace />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const found = validateLogin(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    setServerError('');
    try {
      await login(form.email.trim(), form.password);
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit} noValidate>
        <h1>EMR Appointments</h1>
        <p className="muted">Sign in to continue</p>
        <ErrorMessage message={serverError} />
        <FormField label="Email" error={errors.email}>
          {(id, invalid) => (
            <input id={id} type="email" autoComplete="username" value={form.email} onChange={set('email')} aria-invalid={invalid} autoFocus />
          )}
        </FormField>
        <FormField label="Password" error={errors.password}>
          {(id, invalid) => (
            <input id={id} type="password" autoComplete="current-password" value={form.password} onChange={set('password')} aria-invalid={invalid} />
          )}
        </FormField>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
