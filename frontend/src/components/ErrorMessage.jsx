import { getErrorMessage } from '../api/client';

export default function ErrorMessage({ error, message, onRetry }) {
  if (!error && !message) return null;
  return (
    <div className="alert alert-error" role="alert">
      <span>{message || getErrorMessage(error)}</span>
      {onRetry && (
        <button type="button" className="btn btn-small" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
