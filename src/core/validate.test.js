import { describe, it, expect } from 'vitest'
import {
  validateTurno, normalizeTurn, bookingDecision, dayKey, STATUSES, PRIORITIES,
} from './validate.js'

/**
 * Spec for the package-level validation/normalization layer.
 * Mirrors the error-list style of src/store.js#validateNew (Spanish messages),
 * extended with `capacity` so users can book a turn (turnero).
 * Intended RED: src/core/validate.js does not exist yet.
 */
const valid = {
  title: 'Vacunación grupo 4',
  staff: 'Equipo B',
  hour: '14:00',
  durationMin: 60,
  priority: 'high',
  status: 'confirmed',
  date: '2026-11-11',
}

describe('validateTurno', () => {
  it('returns [] for a valid full turn', () => {
    expect(validateTurno(valid)).toEqual([])
  })

  it('requires title and staff', () => {
    const errors = validateTurno({ ...valid, title: '  ', staff: '' })
    expect(errors).toContain('El título es obligatorio.')
    expect(errors).toContain('El personal es obligatorio.')
  })

  it('requires hour in HH:MM format', () => {
    expect(validateTurno({ ...valid, hour: '25:00' })).toContain('La hora debe ser HH:MM.')
    expect(validateTurno({ ...valid, hour: '9am' })).toContain('La hora debe ser HH:MM.')
    expect(validateTurno({ ...valid, hour: undefined })).toContain('La hora debe ser HH:MM.')
  })

  it('rejects duration below 10 min but accepts it when absent', () => {
    expect(validateTurno({ ...valid, durationMin: 5 })).toContain('La duración debe ser ≥ 10 min.')
    expect(validateTurno({ ...valid, durationMin: 10 })).not.toContain('La duración debe ser ≥ 10 min.')
    const { durationMin, ...noDur } = valid
    expect(validateTurno(noDur)).not.toContain('La duración debe ser ≥ 10 min.')
  })

  it('rejects unknown priority/status; accepts them when absent', () => {
    expect(validateTurno({ ...valid, priority: 'critical' })).toContain('Prioridad inválida.')
    expect(validateTurno({ ...valid, status: 'weird' })).toContain('Estado inválido.')
    const { priority, status, ...defaults } = valid
    expect(validateTurno(defaults)).not.toContain('Prioridad inválida.')
    expect(validateTurno(defaults)).not.toContain('Estado inválido.')
  })

  it('requires a YYYY-MM-DD date and an integer capacity ≥ 1', () => {
    expect(validateTurno({ ...valid, date: '11-11-2026' })).toContain('La fecha debe ser YYYY-MM-DD.')
    expect(validateTurno({ ...valid, capacity: 0 })).toContain('La capacidad debe ser un entero ≥ 1.')
    expect(validateTurno({ ...valid, capacity: 1.5 })).toContain('La capacidad debe ser un entero ≥ 1.')
    expect(validateTurno({ ...valid, capacity: 4 })).not.toContain('La capacidad debe ser un entero ≥ 1.')
  })

  it('exposes the shared domain vocabularies', () => {
    expect(STATUSES).toEqual(['pending', 'confirmed', 'completed', 'cancelled'])
    expect(PRIORITIES).toEqual(['low', 'medium', 'high'])
  })
})

describe('normalizeTurn', () => {
  it('fills defaults: capacity 1, booked [], notes "", status pending, durationMin 30, priority medium', () => {
    const t = normalizeTurn({ id: 'x' })
    expect(t.capacity).toBe(1)
    expect(t.booked).toEqual([])
    expect(t.notes).toBe('')
    expect(t.status).toBe('pending')
    expect(t.durationMin).toBe(30)
    expect(t.priority).toBe('medium')
  })

  it('preserves explicit values and does not mutate the input', () => {
    const raw = { id: 'x', status: 'confirmed', capacity: 3, booked: ['Ana'] }
    const t = normalizeTurn(raw)
    expect(t.booked).toEqual(['Ana'])
    expect(t.capacity).toBe(3)
    expect(raw.booked).toEqual(['Ana'])
    expect(t.booked).not.toBe(raw.booked)
  })
})

describe('bookingDecision (shared rules, single source of truth)', () => {
  it('is null when the slot is bookable', () => {
    expect(bookingDecision({ status: 'confirmed', capacity: 2, booked: ['Ana'] }, 'Luis')).toBeNull()
  })

  it('is "lleno" once booked reaches capacity', () => {
    expect(bookingDecision({ status: 'confirmed', capacity: 1, booked: ['Ana'] }, 'Luis')).toBe('lleno')
  })

  it('is "cancelado" for cancelled turns', () => {
    expect(bookingDecision({ status: 'cancelled', capacity: 5, booked: [] }, 'Luis')).toBe('cancelado')
  })

  it('is "duplicado" when the user already booked', () => {
    expect(bookingDecision({ status: 'pending', capacity: 5, booked: ['Ana'] }, 'Ana')).toBe('duplicado')
  })

  it('is "inexistente" for a missing turn', () => {
    expect(bookingDecision(null, 'Luis')).toBe('inexistente')
  })
})

describe('dayKey', () => {
  it('normalizes padded and unpadded date keys for comparison', () => {
    expect(dayKey('2026-11-03')).toBe('2026-11-3')
    expect(dayKey('2026-11-3')).toBe('2026-11-3')
    expect(dayKey('2026-01-02')).toBe('2026-1-2')
  })
})
