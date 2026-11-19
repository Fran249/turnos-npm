import { STATUS_LABELS, compareByDate } from './utils.js';
import { Store } from './store.js';

/**
 * The register: one ruled row per turn, hour first, status stamped at the
 * end. No cards inside the sheet — the rules do the structural work.
 */
export default function ListView({ onRemove }) {
  const sorted = [...Store()].sort(compareByDate);

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="serif text-xl font-semibold">Lista completa</h2>
        <span className="text-xs tabular-nums text-subtle">{sorted.length} turnos</span>
      </div>

      <ul className="mt-2">
        {sorted.map((t, i) => (
          <li
            key={t.id}
            className="settle flex items-center gap-3 border-b border-border py-3 last:border-0"
            style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}
          >
            <div className="w-12 shrink-0 text-right">
              <span className="serif block text-sm leading-none tabular-nums">{t.hour}</span>
              <span className="mt-1 block text-[10px] tabular-nums text-subtle">
                {t.date.split('-').slice(1).reverse().join('/')}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{t.title}</div>
              <div className="truncate text-xs text-subtle">{t.staff}</div>
            </div>

            <span className={`stamp stamp--${t.status}`}>{STATUS_LABELS[t.status]}</span>

            <button
              onClick={() => onRemove?.(t.id)}
              aria-label={`Eliminar ${t.title}`}
              className="shrink-0 rounded px-1 text-xs font-semibold text-subtle transition-colors hover:text-destructive"
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-xs text-subtle">Elegí una fecha en la semana para ver el horario de ese día.</p>
    </div>
  );
}
