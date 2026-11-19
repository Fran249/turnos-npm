import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ScheduleView from './ScheduleView.jsx'
import { __resetStoreForTests } from './store.js'

const STORE_KEY = 'turnos:turns:v1'

/** Padded `YYYY-MM-DD` offset from today. */
function d(offsetDays) {
  const t = new Date()
  t.setDate(t.getDate() + offsetDays)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

const noop = () => {}

const turn = (id, title, hour, date, extra = {}) => ({
  id, title, staff: 'Equipo A', hour, durationMin: 30,
  priority: 'medium', status: 'confirmed', date, ...extra,
})

/**
 * The store keeps a module-level cache, so each test re-seeds localStorage
 * and resets the cache hook. (Static import + reset hook instead of
 * `vi.resetModules()` + dynamic import: re-importing the whole module graph
 * per test intermittently exceeded the 5s test timeout under full-suite
 * parallel runs on this machine.)
 */
function renderSchedule(turns) {
  localStorage.setItem(STORE_KEY, JSON.stringify(turns))
  __resetStoreForTests()
  render(<ScheduleView selectedDate="" onSelectDate={noop} />)
  return screen
}

describe('ScheduleView ("Horario")', () => {
  it('shows only turns for the selected date (today when empty)', async () => {
    const screen = await renderSchedule([
      turn('t1', 'Mañana A', '09:00', d(0)),
      turn('t2', 'Mañana B', '10:30', d(0)),
      turn('t3', 'Ayer X', '08:00', d(-1)),
    ])
    expect(screen.getByText('Mañana A')).toBeInTheDocument()
    expect(screen.getByText('Mañana B')).toBeInTheDocument()
    expect(screen.queryByText('Ayer X')).not.toBeInTheDocument()
  })

  it('shows a friendly empty state when the date has no turns', async () => {
    const screen = await renderSchedule([
      turn('t3', 'Ayer X', '08:00', d(-1)),
    ])
    expect(screen.queryByText('Ayer X')).not.toBeInTheDocument()
    expect(screen.getByText('No hay turnos para esta fecha')).toBeInTheDocument()
  })

  it('anchors the status dot to its block (relative ancestor, min-height, no fixed height)', async () => {
    const screen = await renderSchedule([
      turn('t1', 'Mañana A', '09:00', d(0)),
    ])
    const block = screen.getByText('Mañana A').parentElement
    expect(block.className).toContain('relative')
    expect(block.style.minHeight).not.toBe('')
    expect(block.style.height).toBe('')
  })

  it('lists blocks in ascending hour order (regression)', async () => {
    const screen = await renderSchedule([
      turn('t1', 'Tarde C', '10:30', d(0)),
      turn('t2', 'Mañana A', '09:00', d(0)),
    ])
    const earlier = screen.getByText('Mañana A')
    const later = screen.getByText('Tarde C')
    expect(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
