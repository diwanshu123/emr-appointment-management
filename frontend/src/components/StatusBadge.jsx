import { memo } from 'react';

const LABELS = { SCHEDULED: 'Scheduled', ARRIVED: 'Arrived', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };

function StatusBadge({ status }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{LABELS[status] || status}</span>;
}

export default memo(StatusBadge);
