import { memo } from 'react';
import { newBlock, standardDays } from '../utils/schedule';

const DURATIONS = [10, 15, 20, 30, 45, 60];

function BlockRows({ blocks, kind, onChange, onRemove }) {
  return blocks.map((b, i) => (
    <div className="block-row" key={i}>
      <input aria-label={`${kind} name`} value={b.name} maxLength={50} onChange={(e) => onChange(i, { name: e.target.value })} />
      <input aria-label={`${kind} start`} type="time" value={b.startTime} onChange={(e) => onChange(i, { startTime: e.target.value })} />
      <input aria-label={`${kind} end`} type="time" value={b.endTime} onChange={(e) => onChange(i, { endTime: e.target.value })} />
      <button type="button" className="icon-btn" aria-label={`Remove ${kind}`} onClick={() => onRemove(i)}>×</button>
    </div>
  ));
}

/** Controlled editor for slot duration + weekly sessions and breaks. */
function ScheduleEditor({ slotDuration, onSlotDuration, days, onDays }) {
  const update = (i, patch) => onDays(days.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const changeBlock = (i, kind, j, patch) => update(i, { [kind]: days[i][kind].map((b, k) => (k === j ? { ...b, ...patch } : b)) });
  const addBlock = (i, kind) => update(i, { [kind]: [...days[i][kind], newBlock(kind === 'sessions' ? 'session' : 'break')] });
  const removeBlock = (i, kind, j) => update(i, { [kind]: days[i][kind].filter((_, k) => k !== j) });

  return (
    <div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="slot-duration">Slot duration</label>
          <select id="slot-duration" value={slotDuration} onChange={(e) => onSlotDuration(Number(e.target.value))}>
            {DURATIONS.map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </div>
        <div className="field">
          <label>&nbsp;</label>
          <button type="button" className="btn" onClick={() => onDays(standardDays())}>Use standard Mon–Sat schedule</button>
        </div>
      </div>

      {days.map((day, i) => (
        <div className="day-box" key={day.dayOfWeek}>
          <h3>
            <label>
              <input type="checkbox" checked={day.enabled} onChange={(e) => update(i, { enabled: e.target.checked, ...(e.target.checked && day.sessions.length === 0 ? { sessions: [newBlock('session')] } : {}) })} /> {day.label}
            </label>
          </h3>
          {day.enabled && (
            <>
              <div className="block-label">Sessions (name, start, end)</div>
              <BlockRows blocks={day.sessions} kind="session" onChange={(j, p) => changeBlock(i, 'sessions', j, p)} onRemove={(j) => removeBlock(i, 'sessions', j)} />
              <button type="button" className="btn btn-small" style={{ marginTop: '0.4rem' }} onClick={() => addBlock(i, 'sessions')}>+ Session</button>
              <div className="block-label">Breaks (no slots are generated during breaks)</div>
              <BlockRows blocks={day.breaks} kind="break" onChange={(j, p) => changeBlock(i, 'breaks', j, p)} onRemove={(j) => removeBlock(i, 'breaks', j)} />
              <button type="button" className="btn btn-small" style={{ marginTop: '0.4rem' }} onClick={() => addBlock(i, 'breaks')}>+ Break</button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default memo(ScheduleEditor);
