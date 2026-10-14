import { memo } from 'react';
import { formatTime } from '../utils/date';

const TITLES = {
  AVAILABLE: 'Available — click to book',
  BOOKED: 'Already booked',
  PAST: 'This time has passed',
};

// Memoised: when one slot changes (live update) only that button re-renders.
const SlotButton = memo(function SlotButton({ slot, onSelect }) {
  const title = slot.status === 'BOOKED' && slot.patientName ? `Booked: ${slot.patientName}` : TITLES[slot.status];
  return (
    <button
      type="button"
      className={`slot slot-${slot.status.toLowerCase()}`}
      disabled={slot.status !== 'AVAILABLE'}
      title={title}
      onClick={() => onSelect(slot)}
    >
      {formatTime(slot.startTime)}
    </button>
  );
});

function SlotGrid({ slots, onSelect }) {
  if (slots.length === 0) return <p className="muted">No slots on this day.</p>;
  return (
    <div className="slot-grid">
      {slots.map((slot) => (
        <SlotButton key={slot.startTime} slot={slot} onSelect={onSelect} />
      ))}
    </div>
  );
}

export default memo(SlotGrid);
