import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TurnoPicker from '../templates/TurnoPicker.jsx'
import TurnoAdmin from '../templates/TurnoAdmin.jsx'
import { createClient } from './core/index.js'

/**
 * Behavioural spec for the generated components (templates/). They are
 * provider-agnostic: a memory client drives them here; consumers get the
 * exact same components with their Firebase/Supabase config.
 * Intended RED: templates exist since stage 2 but their behaviour was
 * never pinned — anything they do wrong is a real RED.
 */
const pickSeed = [
  { id: 'p1', title: 'Mañana', staff: 'Equipo A', hour: '09:00', durationMin: 30, status: 'confirmed', date: '2026-11-11', capacity: 2 },
  { id: 'p2', title: 'Tarde completo', staff: 'Equipo B', hour: '16:30', status: 'confirmed', date: '2026-11-11', capacity: 1, booked: ['Otro'] },
  { id: 'p3', title: 'Noche', staff: 'Equipo C', hour: '08:00', status: 'cancelled', date: '2026-11-11' },
]
const pickerAdapter = () => createClient({ provider: 'memory', turns: pickSeed.map((t) => ({ ...t, booked: [...(t.booked || [])] })) })

const adminSeed = [
  { id: 'a2', title: 'Tarde', staff: 'B', hour: '16:00', status: 'confirmed', date: '2026-11-12' },
  { id: 'a1', title: 'Mañana', staff: 'A', hour: '09:00', status: 'pending', date: '2026-11-11' },
]
const adminAdapter = () => createClient({ provider: 'memory', turns: adminSeed.map((t) => ({ ...t })) })

describe('TurnoPicker (componente del usuario)', () => {
  it('lists the day turns sorted by hour', async () => {
    render(<TurnoPicker adapter={pickerAdapter()} user="Elsil" date="2026-11-11" />)
    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(3)
    const horas = items.map((li) => li.textContent.match(/\d{2}:\d{2}/)[0])
    expect(horas).toEqual([...horas].sort()) // ascending hour
    expect(items[0].textContent).toContain('Noche') // 08:00 first
  })

  it('books a free turn: success notice, onBooked, then shows "Quitar"', async () => {
    const onBooked = vi.fn()
    const adapter = pickerAdapter()
    render(<TurnoPicker adapter={adapter} user="Elsil" date="2026-11-11" onBooked={onBooked} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Elegir' }))
    await waitFor(() => expect(onBooked).toHaveBeenCalledTimes(1))
    expect(onBooked.mock.calls[0][0].booked).toContain('Elsil')
    expect(screen.getByText(/¡Listo!/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar' })).toBeInTheDocument()
  })

  it('a full turn shows a disabled "Completado" button', async () => {
    render(<TurnoPicker adapter={pickerAdapter()} user="Elsil" date="2026-11-11" />)
    const completo = await screen.findByRole('button', { name: 'Completado' })
    expect(completo).toBeDisabled()
    expect(screen.getByText('1/1 elegidos')).toBeInTheDocument()
  })

  it('a cancelled turn shows a disabled "Cancelado" button', async () => {
    render(<TurnoPicker adapter={pickerAdapter()} user="Elsil" date="2026-11-11" />)
    const cancelado = await screen.findByRole('button', { name: 'Cancelado' })
    expect(cancelado).toBeDisabled()
  })

  it('shows "Quitar" for a turn the user already chose; clicking frees the slot', async () => {
    const onUnbooked = vi.fn()
    const seed = [
      { id: 'p1', title: 'Mañana', staff: 'Equipo A', hour: '09:00', status: 'confirmed', date: '2026-11-11', capacity: 2, booked: ['Elsil'] },
    ]
    const adapter = createClient({ provider: 'memory', turns: seed })
    render(<TurnoPicker adapter={adapter} user="Elsil" date="2026-11-11" onUnbooked={onUnbooked} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar' }))
    await waitFor(() => expect(onUnbooked).toHaveBeenCalledTimes(1))
    expect(onUnbooked.mock.calls[0][0].booked).toEqual([])
    await screen.findByRole('button', { name: 'Elegir' }) // free again
  })

  it('an empty day shows the empty state', async () => {
    render(<TurnoPicker adapter={pickerAdapter()} user="Elsil" date="2026-12-25" />)
    expect(await screen.findByText('No hay turnos para este día.')).toBeInTheDocument()
  })

  it('without a user identifier it warns instead of booking', async () => {
    const adapter = pickerAdapter()
    const spy = vi.spyOn(adapter, 'bookTurno')
    render(<TurnoPicker adapter={adapter} date="2026-11-11" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Elegir' }))
    await waitFor(() => expect(screen.getByText(/Falta el identificador/)).toBeInTheDocument())
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('TurnoAdmin (componente del administrador)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', window)
    window.confirm = vi.fn(() => true)
  })

  afterEach(() => {
    window.confirm = vi.fn()
    vi.unstubAllGlobals()
  })

  it('lists turns sorted by date, then hour', async () => {
    render(<TurnoAdmin adapter={adminAdapter()} />)
    const items = await screen.findAllByRole('listitem')
    expect(items[0].textContent).toContain('2026-11-11')
    expect(items[0].textContent).toContain('Mañana')
    expect(items[1].textContent).toContain('2026-11-12')
  })

  it('creates a turn through the form and the list grows', async () => {
    const adapter = adminAdapter()
    render(<TurnoAdmin adapter={adapter} />)
    fireEvent.change(screen.getByPlaceholderText(/Título/), { target: { value: 'Extra' } })
    fireEvent.change(screen.getByPlaceholderText('Equipo B *'), { target: { value: 'Equipo C' } })
    fireEvent.change(screen.getByPlaceholderText(/HH:MM/), { target: { value: '10:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear turno' }))
    await waitFor(() => expect(screen.getByText('Turno creado.')).toBeInTheDocument())
    expect(await screen.findAllByRole('listitem')).toHaveLength(3)
    const nuevo = (await adapter.listTurnos()).find((t) => t.title === 'Extra')
    expect(nuevo.status).toBe('pending')
    expect(nuevo.hour).toBe('10:30')
  })

  it('shows the adapter validation errors when the form is invalid', async () => {
    render(<TurnoAdmin adapter={adminAdapter()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Crear turno' })) // vacío
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert').textContent).toContain('El título es obligatorio.')
    expect(screen.getByRole('alert').textContent).toContain('La hora debe ser HH:MM.')
  })

  it('changes a turn status with a patch upsert ({ id, status })', async () => {
    const adapter = adminAdapter()
    const spy = vi.spyOn(adapter, 'upsertTurno')
    render(<TurnoAdmin adapter={adapter} />)
    const select = await screen.findByRole('combobox', { name: /Estado de Mañana/ })
    fireEvent.change(select, { target: { value: 'confirmed' } })
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ id: 'a1', status: 'confirmed' }),
    )
  })

  it('removes a turn only after confirm()', async () => {
    const adapter = adminAdapter()
    const spy = vi.spyOn(adapter, 'removeTurno')
    render(<TurnoAdmin adapter={adapter} />)
    const botones = await screen.findAllByRole('button', { name: /Eliminar/ })
    fireEvent.click(botones[0]) // 'Mañana' (a1): primer fila por orden fecha+hora
    await waitFor(() => expect(spy).toHaveBeenCalledWith('a1'))
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1))
  })
})
