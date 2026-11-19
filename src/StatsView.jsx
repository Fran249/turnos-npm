import { useEffect, useMemo, useState } from 'react';
import { STATUS_LABELS, PRIORITY_LABELS, STATUS_COLOR, PRIORITY_COLOR } from './utils.js';
import { Store } from './store.js';

export default function StatsView({ open, onClose }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (open) setTick((n) => n + 1);
  }, [open]);

  useEffect(() => {
    const h = () => setTick((n) => n + 1);
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }, []);

  const stats = useMemo(() => (open ? compute() : null), [open, tick]);

  if (!open) return null;

  const counts = stats ? stats.counts : { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
  const byPriority = stats ? stats.byPriority : { low: 0, medium: 0, high: 0 };
  const total = stats ? stats.totals : 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/35 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-titulo"
        className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="stats-titulo" className="serif text-xl font-semibold">Estadísticas de turnos</h2>
            <p className="mt-1 text-xs tabular-nums text-subtle">{total} turnos en total</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="btn btn-ghost h-8 w-8 p-0">×</button>
        </div>

        <Block title="Estado" labels={STATUS_LABELS} values={counts} colors={STATUS_COLOR} />
        <Block title="Prioridad" labels={PRIORITY_LABELS} values={byPriority} colors={PRIORITY_COLOR} />

        <button onClick={onClose} className="btn btn-primary mt-6 w-full">Cerrar</button>
      </div>
    </div>
  );
}

function compute() {
  const counts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
  const byPriority = { low: 0, medium: 0, high: 0 };
  for (const t of Store()) {
    counts[t.status] = (counts[t.status] || 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
  }
  return { counts, byPriority, totals: Object.values(counts).reduce((a, b) => a + b, 0) };
}

function Block({ title, labels, values, colors }) {
  return (
    <section className="mt-6">
      <h3 className="serif text-sm font-semibold">{title}</h3>
      <ul className="mt-2">
        {Object.entries(labels).map(([key, label]) => (
          <li key={key} className="flex items-baseline gap-2 border-b border-border py-1.5 last:border-0">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colors[key] }} aria-hidden />
            <span className="text-xs font-semibold">{label}</span>
            <span className="leader" aria-hidden />
            <span className="serif text-sm tabular-nums">{values[key] ?? 0}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
