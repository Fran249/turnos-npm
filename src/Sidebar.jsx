import { Store } from './store.js';
import { STATUS_COLOR, STATUS_LABELS } from './utils.js';

const ORDEN = ['confirmed', 'pending', 'completed', 'cancelled'];

/** A compact register of the whole store. Dotted leaders, tabs-free numbers. */
export default function Sidebar() {
  const store = Store();
  const counts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
  for (const t of store) counts[t.status] = (counts[t.status] || 0) + 1;

  return (
    <div className="card">
      <h2 className="serif text-base font-semibold">Resumen</h2>

      <ul className="mt-3">
        {ORDEN.map((key) => (
          <li key={key} className="flex items-baseline gap-2 py-1.5">
            <span
              className="relative top-[-1px] h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: STATUS_COLOR[key] }}
              aria-hidden
            />
            <span className="text-xs font-semibold text-foreground">{STATUS_LABELS[key]}</span>
            <span className="leader" aria-hidden />
            <span className="serif text-sm tabular-nums">{counts[key] ?? 0}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-subtle">
        {store.length} turnos cargados en la agenda.
      </p>
    </div>
  );
}
