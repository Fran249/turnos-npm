import { addDays } from 'date-fns'
import { Store } from './store.js'
import { WEEK_SHORT, DIA_LARGO, MES_LARGO, dayKey, isoKey, parseTurnDate, todayKey } from './utils.js'

/**
 * The week strip is the dashboard's signature: a week is the unit a roster
 * is planned in, so the seven days sit under the date headline as a tear-off
 * strip. A moss rule marks days that have turns; the selected day is inked.
 */
export default function WeekStrip({ date, onSelect }) {
  const base = parseTurnDate(date || todayKey())
  const start = addDays(base, -((base.getDay() + 6) % 7)) // Monday-first

  const counts = {}
  for (const t of Store()) {
    if (t.status === 'cancelled') continue
    counts[dayKey(t.date)] = (counts[dayKey(t.date)] || 0) + 1
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const selectedKey = dayKey(date || todayKey())

  return (
    <div className="mt-7 grid grid-cols-7 divide-x divide-border border-y border-border">
      {days.map((d) => {
        const key = isoKey(d)
        const selected = key === selectedKey
        const count = counts[key] || 0
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            aria-pressed={selected}
            aria-label={`${DIA_LARGO[d.getDay()]} ${d.getDate()} de ${MES_LARGO[d.getMonth()]}${count ? `, ${count} turnos` : ''}`}
            className={`group py-3 transition-colors duration-fast ${selected ? 'bg-ink text-card' : 'text-foreground hover:bg-background'}`}
          >
            <span className={`block text-[11px] font-semibold ${selected ? 'text-card/70' : 'text-subtle'}`}>
              {WEEK_SHORT[(d.getDay() + 6) % 7]}
            </span>
            <span className="serif mt-1 block text-xl leading-none tabular-nums">{d.getDate()}</span>
            <span
              className={`mx-auto mt-1.5 block h-[2px] w-5 rounded-full ${count ? (selected ? 'bg-card/70' : 'bg-moss') : 'bg-transparent'}`}
              aria-hidden
            />
          </button>
        )
      })}
    </div>
  )
}
