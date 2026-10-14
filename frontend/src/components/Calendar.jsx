import { memo, useMemo, useState } from 'react';
import { monthGrid, parseDate, todayStr } from '../utils/date';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Month calendar. Days before `minDate` are disabled (no booking in the past). */
function Calendar({ value, onChange, minDate }) {
  const [view, setView] = useState(() => {
    const d = parseDate(value);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const cells = useMemo(() => monthGrid(view.y, view.m), [view]);
  const today = todayStr();

  const shift = (delta) =>
    setView(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const title = new Date(view.y, view.m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="calendar">
      <div className="calendar-head">
        <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
          ‹
        </button>
        <strong>{title}</strong>
        <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="calendar-grid">
        {WEEKDAYS.map((d) => (
          <span key={d} className="calendar-weekday">
            {d}
          </span>
        ))}
        {cells.map((date, i) =>
          date ? (
            <button
              key={date}
              type="button"
              disabled={minDate && date < minDate}
              aria-pressed={date === value}
              className={`calendar-day ${date === value ? 'selected' : ''} ${date === today ? 'today' : ''}`}
              onClick={() => onChange(date)}
            >
              {Number(date.slice(8))}
            </button>
          ) : (
            <span key={`pad-${i}`} />
          )
        )}
      </div>
    </div>
  );
}

export default memo(Calendar);
