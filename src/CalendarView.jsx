import { WEEK_SHORT, todayKey, dayKey, mesLargo, isoKey } from './utils.js';
import { addMonths, subMonths } from 'date-fns';
import { Store } from './store.js';

/**
 * Month grid. The day cell carries what a scheduler actually asks: how many
 * turns that day holds. Selected day is inked, today's numeral is moss.
 */
export default function CalendarView({ month, onMonthChange, selectedDate, onSelectDate }) {
  const store = Store();
  const counts = {}; // date -> number of active turns
  for (const t of store) {
    if (t.status === 'cancelled') continue;
    counts[dayKey(t.date)] = (counts[dayKey(t.date)] || 0) + 1;
  }
  const today = dayKey(todayKey());

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="serif text-xl font-semibold">Calendario de turnos</h2>
        <div className="flex items-center gap-2">
          <button aria-label="Mes anterior" onClick={() => onMonthChange(subMonths(month, 1))} className="btn btn-ghost h-8 w-8 p-0 text-base">‹</button>
          <span className="serif min-w-[7.5rem] text-center text-sm font-semibold tabular-nums">{mesLargo(month)}</span>
          <button aria-label="Mes siguiente" onClick={() => onMonthChange(addMonths(month, 1))} className="btn btn-ghost h-8 w-8 p-0 text-base">›</button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-subtle">
        {WEEK_SHORT.map((d, i) => <div key={i} className="pb-2">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1 border-t border-border pt-1">
        {buildDays(month, counts, selectedDate, onSelectDate, today)}
      </div>
    </div>
  );
}

function buildDays(month, counts, selectedDate, onSelectDate, today) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const startOffset = first.getDay();
  const daysInMonth = last.getDate();
  const results = [];

  for (let i = 0; i < startOffset; i++) results.push(<span key={`gap-${i}`} />);

  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(month.getFullYear(), month.getMonth(), d);
    const key = isoKey(cellDate);
    const isSelected = selectedDate === key || selectedDate === dayKey(key);
    const isToday = key === today;
    const c = counts[key] || 0;

    results.push(
      <button
        key={d}
        onClick={() => onSelectDate(key)}
        aria-pressed={isSelected}
        aria-label={`${d} de ${mesLargo(month)}${c ? `, ${c} turnos` : ''}`}
        className={`relative aspect-square rounded-md p-1 text-sm transition-colors ${isSelected ? 'bg-ink text-card' : 'hover:bg-background'}`}
      >
        <span className={`serif absolute left-1.5 top-1 text-[0.95rem] leading-none tabular-nums ${isSelected ? 'text-card' : isToday ? 'text-moss' : 'text-foreground'}`}>
          {d}
        </span>
        {c > 0 && (
          <span className={`serif absolute bottom-1 right-1.5 text-[10px] leading-none tabular-nums ${isSelected ? 'text-card/70' : 'text-subtle'}`}>
            {c}
          </span>
        )}
      </button>,
    );
  }
  return results;
}
