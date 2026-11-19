import { todayKey, dayKey, STATUS_COLOR, STATUS_LABELS, fechaLarga } from './utils.js';
import { Store } from './store.js';

const FRANJAS = ['Mañana', 'Tarde', 'Noche'];

/** Franja de la hora: Mañana 00–11 h, Tarde 12–17 h, Noche 18–23 h. */
function franjaDe(hour) {
  const h = parseInt(String(hour || '00:00').slice(0, 2), 10);
  return h < 12 ? 'Mañana' : h < 18 ? 'Tarde' : 'Noche';
}

/**
 * The day as a time rail: hour in the left gutter, block width = duration,
 * left rule = status. The rail is why the hour is set in the display face.
 */
export default function ScheduleView({ selectedDate, onSelectDate }) {
  // Calendar emits unpadded keys (dayKey); store dates are padded — normalize both.
  const date = selectedDate || todayKey();
  const turns = Store().filter((t) => t.status !== 'cancelled' && dayKey(t.date) === dayKey(date));
  const grupos = FRANJAS.map((f) => [f, scheduleRows(turns.filter((t) => franjaDe(t.hour) === f))])
    .filter(([, rows]) => rows.length > 0);

  return (
    <div className="card">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="serif text-xl font-semibold">Horario de turnos</h2>
        <div className="flex items-center gap-3">
          <span className="serif text-sm tabular-nums text-subtle">{fechaLarga(date)}</span>
          <button onClick={() => onSelectDate('')} className="text-xs font-semibold text-moss hover:underline">Hoy</button>
        </div>
      </div>

      {grupos.length > 0 ? grupos.map(([franja, rows]) => (
        <section key={franja} className="mt-5">
          <div className="mb-2 flex items-center gap-3">
            <span className="text-[11px] font-semibold text-subtle">{franja}</span>
            <span className="h-px flex-1 bg-border" aria-hidden />
            <span className="serif text-[11px] tabular-nums text-subtle">{rows.length}</span>
          </div>
          {rows}
        </section>
      )) : (
        <div className="py-10 text-center">
          <p className="serif text-base">No hay turnos para esta fecha</p>
          <p className="mt-1 text-xs text-subtle">Elegí otro día en el calendario o en la semana.</p>
        </div>
      )}

      <p className="mt-4 text-xs text-subtle">El borde izquierdo marca el estado; el ancho, la duración.</p>
    </div>
  );
}

/** One block per turn; within a band, sorted by start hour. */
function scheduleRows(turns) {
  const sorted = [...turns].sort((a, b) => (a.hour < b.hour ? -1 : a.hour > b.hour ? 1 : 0));
  return sorted.map((t) => {
    const duration = t.durationMin || 30;
    const widthPct = Math.max(Math.min((duration / 60) * 100, 96), 28);
    // Content is two lines + padding; use min-height so it never clips.
    const minH = Math.max(Math.round(duration / 60 * 52), 52);
    return (
      <div key={t.id} className="my-1 flex items-start gap-3">
        <div className="w-12 shrink-0 pt-1 text-right">
          <span className="serif block text-[0.95rem] leading-none tabular-nums">{t.hour}</span>
          <span className="mt-1 block text-[10px] tabular-nums text-subtle">{duration} min</span>
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="relative grid grid-cols-[1fr_auto] gap-x-2 overflow-hidden rounded-md border-l-[3px] bg-background p-2.5"
            style={{ borderLeftColor: STATUS_COLOR[t.status], width: `${widthPct}%`, minHeight: `${minH}px` }}
          >
            <div className="truncate text-sm font-semibold" title={t.title}>{t.title}</div>
            <span className={`stamp stamp--${t.status} self-start`}>{STATUS_LABELS[t.status]}</span>
            <span className="truncate text-[11px] text-subtle">{t.staff}</span>
            <span className="text-right text-[10px] tabular-nums text-subtle">+{duration}</span>
          </div>
        </div>
      </div>
    );
  });
}
