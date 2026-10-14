import { useId } from 'react';

/** Label + control + inline error, wired together for accessibility. */
export default function FormField({ label, error, hint, children }) {
  const id = useId();
  const control = children(id, Boolean(error));
  return (
    <div className={`field ${error ? 'field-invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {control}
      {hint && !error && <small className="hint">{hint}</small>}
      {error && (
        <small className="error-text" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
