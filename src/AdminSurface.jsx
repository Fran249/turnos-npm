import { useEffect, useReducer, useState } from 'react'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import StatsView from './StatsView.jsx'
import TurnoAdmin from '../templates/TurnoAdmin.jsx'
import { demoAdapter } from './demoAdapter.js'
import { Store } from './store.js'

/**
 * The person managing.
 *
 * The generated admin component does the work — create, change status,
 * delete — and the demo's own summary sits beside it as the desk pad. No
 * booking controls here: a manager doesn't take a slot, they keep the day.
 */
export default function AdminSurface() {
  const [statsOpen, setStatsOpen] = useState(false)
  const [, tick] = useReducer((n) => n + 1, 0)

  useEffect(() => demoAdapter.subscribe(() => tick()), [])

  const total = Store().length

  return (
    <div className="min-h-screen">
      <TopBar path="/admin" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-9">
          <div>
            <h1 className="serif text-[1.9rem] leading-[1.05] tracking-tight sm:text-[2.6rem]">
              Administración
            </h1>
            <p className="mt-2 text-sm text-subtle">
              {total === 1 ? '1 turno en el registro' : `${total} turnos en el registro`}
            </p>
          </div>
          <button type="button" onClick={() => setStatsOpen(true)} className="btn btn-ghost">
            Estadísticas
          </button>
        </section>

        <main className="grid gap-6 py-7 lg:grid-cols-[minmax(0,1fr)_248px] lg:items-start">
          <section className="min-w-0">
            <TurnoAdmin adapter={demoAdapter} />
          </section>
          <aside className="lg:sticky lg:top-24">
            <Sidebar />
          </aside>
        </main>
      </div>

      {statsOpen && <StatsView open onClose={() => setStatsOpen(false)} />}
    </div>
  )
}
