import { useEffect, useReducer, useState } from 'react'
import TopBar from './TopBar.jsx'
import WeekStrip from './WeekStrip.jsx'
import CalendarView from './CalendarView.jsx'
import TurnoPicker from '../templates/TurnoPicker.jsx'
import { demoAdapter, demoUser } from './demoAdapter.js'
import { Store } from './store.js'
import { fechaLarga, todayKey, parseTurnDate, dayKey } from './utils.js'

/**
 * The person booking.
 *
 * One page, two halves: the calendar is the index (which day do I want?) and
 * the picker is the page itself (which turn do I take?). The week strip under
 * the date is the tear-off ribbon that ties both together. Nothing here
 * creates, deletes or reports: that is the administrator's surface.
 */
export default function UserSurface() {
  const [date, setDate] = useState(todayKey)
  const [month, setMonth] = useState(() => parseTurnDate(todayKey()))
  const [, tick] = useReducer((n) => n + 1, 0)

  // Bookings and admin writes land in the same store: re-read it on every change.
  useEffect(() => demoAdapter.subscribe(() => tick()), [])

  /** Picking a day also turns the calendar to that day's month. */
  function elegirDia(next) {
    setDate(next)
    setMonth(parseTurnDate(next))
  }

  const delDia = Store().filter((t) => t.status !== 'cancelled' && dayKey(t.date) === dayKey(date))
  const cantidad =
    delDia.length === 0
      ? 'Sin turnos para este día'
      : delDia.length === 1
        ? '1 turno para elegir'
        : `${delDia.length} turnos para elegir`

  return (
    <div className="min-h-screen">
      <TopBar path="/user" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="pt-9">
          <h1 className="serif text-[1.9rem] leading-[1.05] tracking-tight sm:text-[2.6rem]">
            {fechaLarga(date)}
          </h1>
          <p className="mt-2 text-sm text-subtle">{cantidad}</p>
          <WeekStrip date={date} onSelect={elegirDia} />
        </section>

        <main className="grid gap-6 py-7 lg:grid-cols-[288px_minmax(0,1fr)] lg:items-start">
          <aside className="order-2 lg:order-1 lg:sticky lg:top-24">
            <CalendarView
              month={month}
              onMonthChange={setMonth}
              selectedDate={date}
              onSelectDate={elegirDia}
            />
            <p className="mt-3 px-1 text-xs leading-relaxed text-subtle">
              El calendario es el índice: elegí un día y a la derecha aparecen sus talones para reservar.
            </p>
          </aside>

          <section className="order-1 min-w-0 lg:order-2">
            <TurnoPicker
              key={date}
              adapter={demoAdapter}
              user={demoUser}
              date={date}
              onDateChange={elegirDia}
              showDateNav={false}
            />
          </section>
        </main>
      </div>
    </div>
  )
}
