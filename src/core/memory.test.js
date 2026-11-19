import { describe, it, expect } from 'vitest'
import { createMemoryClient } from './memory.js'

/**
 * Spec for the in-memory adapter — the reference implementation of the
 * provider-agnostic client contract (listTurnos/bookTurno/upsertTurno/
 * removeTurno/subscribe). Mutation semantics ported from src/store.js
 * (upsert/remove + timestamps), plus booking with capacity.
 * Intended RED: src/core/memory.js does not exist yet.
 */
function seed() {
  return [
    { id: 't1', title: 'Mañana', staff: 'Equipo A', hour: '09:00', durationMin: 30, priority: 'medium', status: 'confirmed', date: '2026-11-03', capacity: 2 },
    { id: 't2', title: 'Tarde', staff: 'Equipo B', hour: '16:30', durationMin: 45, priority: 'high', status: 'cancelled', date: '2026-11-12' },
    { id: 't3', title: 'Noche', staff: 'Equipo C', hour: '20:00', durationMin: 30, priority: 'low', status: 'pending', date: '2026-11-03', capacity: 1, booked: ['Ana'] },
  ]
}

describe('createMemoryClient', () => {
  it('exposes provider = "memory" and lists normalized turns', async () => {
    const c = createMemoryClient({ turns: seed() })
    expect(c.provider).toBe('memory')
    const turns = await c.listTurnos()
    expect(turns).toHaveLength(3)
    expect(turns.find((t) => t.id === 't1').booked).toEqual([]) // default filled
    expect(turns.find((t) => t.id === 't2').capacity).toBe(1)
  })

  it('filters by date, normalizing unpadded calendar keys vs padded stored dates', async () => {
    const c = createMemoryClient({ turns: seed() })
    const padded = await c.listTurnos({ date: '2026-11-12' })
    expect(padded.map((t) => t.id)).toEqual(['t2'])
    const unpadded = await c.listTurnos({ date: '2026-11-3' })
    expect(unpadded.map((t) => t.id).sort()).toEqual(['t1', 't3'])
  })

  it('assigns a generated id to seeded turns that arrive without one', async () => {
    const c = createMemoryClient({ turns: [{ title: 'Sin id', staff: 'Equipo A', hour: '09:00', date: '2026-11-13', capacity: 1 }] })
    const [t] = await c.listTurnos()
    expect(t.id).toBeTruthy()
    expect((await c.bookTurno(t.id, 'Ana')).ok).toBe(true)
    expect((await c.listTurnos())[0].booked).toEqual(['Ana'])
  })

  it('upsertTurno creates with generated id + timestamps', async () => {
    const c = createMemoryClient({ turns: [] })
    const res = await c.upsertTurno({ title: 'Extra', staff: 'E', hour: '10:00', date: '2026-11-13' })
    expect(res.ok).toBe(true)
    expect(res.turn.id).toBeTruthy()
    expect(res.turn.createdAt).toBeTypeOf('number')
    expect((await c.listTurnos()).filter((t) => t.id === res.turn.id)).toHaveLength(1)
  })

  it('upsertTurno on invalid input returns { ok: false, errors } without throwing', async () => {
    const c = createMemoryClient({ turns: seed() })
    const res = await c.upsertTurno({ staff: 'X', hour: '09:00', date: '2026-11-11' })
    expect(res.ok).toBe(false)
    expect(res.errors).toContain('El título es obligatorio.')
    expect(await c.listTurnos()).toHaveLength(3) // untouched
  })

  it('upsertTurno merges a partial update over the existing turn (validation on the merge)', async () => {
    const c = createMemoryClient({ turns: seed() })
    const res = await c.upsertTurno({ id: 't1', status: 'completed' })
    expect(res.ok).toBe(true)
    const t1 = (await c.listTurnos()).find((t) => t.id === 't1')
    expect(t1.status).toBe('completed')
    expect(t1.title).toBe('Mañana') // preserved
  })

  it('removeTurno deletes; removing an unknown id is a no-op but ok', async () => {
    const c = createMemoryClient({ turns: seed() })
    expect((await c.removeTurno('t1')).ok).toBe(true)
    expect((await c.listTurnos()).map((t) => t.id)).toEqual(['t2', 't3'])
    expect((await c.removeTurno('nope')).ok).toBe(true)
  })

  it('bookTurno adds the user within capacity', async () => {
    const c = createMemoryClient({ turns: seed() })
    const res = await c.bookTurno('t1', 'Luis')
    expect(res.ok).toBe(true)
    expect(res.turn.booked).toEqual(['Luis'])
  })

  it('bookTurno returns the shared error codes: lleno, cancelado, duplicado, inexistente', async () => {
    const c = createMemoryClient({ turns: seed() })
    expect((await c.bookTurno('t1', 'B')).ok).toBe(true)
    expect((await c.bookTurno('t1', 'C')).ok).toBe(true) // 2/2
    expect((await c.bookTurno('t1', 'D')).error).toBe('lleno') // over capacity 2
    expect((await c.bookTurno('t2', 'B')).error).toBe('cancelado')
    expect((await c.bookTurno('t3', 'Ana')).error).toBe('duplicado')
    expect((await c.bookTurno('t3', 'B')).error).toBe('lleno') // t3 capacity 1, Ana inside
    expect((await c.bookTurno('zzz', 'B')).error).toBe('inexistente')
  })

  it('unbookTurno frees the slot and allows re-booking', async () => {
    const c = createMemoryClient({ turns: seed() })
    await c.bookTurno('t1', 'Luis')
    const un = await c.unbookTurno('t1', 'Luis')
    expect(un.ok).toBe(true)
    expect(un.turn.booked).toEqual([])
    expect((await c.bookTurno('t1', 'B')).ok).toBe(true)
    expect((await c.unbookTurno('zzz', 'B')).error).toBe('inexistente')
  })

  it('subscribe fires immediately, on each mutation, and stops after unsubscribe', async () => {
    const c = createMemoryClient({ turns: seed() })
    const calls = []
    const un = c.subscribe((turns) => calls.push(turns.length))
    expect(calls.length).toBe(1) // immediate emit
    expect(calls[0]).toBe(3)
    await c.upsertTurno({ title: 'Extra', staff: 'E', hour: '10:00', date: '2026-11-13' })
    expect(calls.length).toBe(2)
    expect(calls[1]).toBe(4)
    un()
    await c.upsertTurno({ title: 'Extra2', staff: 'E', hour: '11:00', date: '2026-11-13' })
    expect(calls.length).toBe(2) // unsubscribed: no more emissions
  })
})
