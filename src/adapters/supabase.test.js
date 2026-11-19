import { describe, it, expect, vi } from 'vitest'
import { createClient } from '../core/index.js'

/**
 * Contract tests for the Supabase adapter (src/adapters/supabase.js).
 *
 * The package never imports `@supabase/supabase-js` at top level: the
 * generated consumer config (`templates/config.turnos.supabase.js`) injects
 * the supabase client + table name. This fake reproduces the injected
 * surface over an in-memory store with snake_case rows:
 *  - `from(table)` builder: .select / .eq / .order / .insert / .update / .delete
 *    (awaitable -> { data, error }),
 *  - `rpc('book_turno', { turno_id, user })` -> { data: boolean } mirroring
 *    the SQL function in templates/sql/0001_turnos.sql (for-update guards),
 *  - `channel(topic).on('postgres_changes', filter, cb).subscribe()` +
 *    `removeChannel()` mirroring supabase-js realtime.
 *
 * Intended RED: the registry only knows 'memory'/'firebase' — every test
 * below fails with "proveedor desconocido: supabase" until stage 5 lands.
 */

const SEED = [
  { id: 'a1', title: 'Mañana', staff: 'Equipo A', hour: '09:00', date: '2026-11-03', status: 'confirmed', capacity: 1, booked: [], notes: '', duration_min: 30, priority: 'medium' },
  { id: 'a2', title: 'Tarde', staff: 'Equipo B', hour: '16:00', date: '2026-11-04', status: 'pending', capacity: 1, booked: [], notes: '', duration_min: 30, priority: 'medium' },
  { id: 'cx', title: 'Cancelado', staff: 'C', hour: '08:00', date: '2026-11-03', status: 'cancelled', capacity: 1, booked: [], notes: '', duration_min: 30, priority: 'medium' },
  { id: 'full', title: 'Lleno', staff: 'D', hour: '10:00', date: '2026-11-03', status: 'confirmed', capacity: 1, booked: ['Otro'], notes: '', duration_min: 30, priority: 'medium' },
  { id: 'dup', title: 'Ya elegí', staff: 'E', hour: '11:00', date: '2026-11-03', status: 'confirmed', capacity: 2, booked: ['Elsil'], notes: '', duration_min: 30, priority: 'medium' },
]

function fakeSupabase(seed = SEED) {
  const store = new Map(seed.map((r) => [r.id, { ...r, booked: [...(r.booked || [])] }]))
  const channels = []
  const rpcCalls = []
  const queries = []
  const rowSnap = (r) => ({ ...r, booked: [...(r.booked || [])] })
  // Mirror Postgres realtime: listeners are pushed after each mutation.
  const push = () =>
    queueMicrotask(() => {
      for (const c of [...channels]) if (c._handler) c._handler({ type: c._type, filter: c._filter })
    })

  function makeBuilder(table) {
    const q = { _eqs: [], _order: null, _select: null, _insert: null, _update: null, _delete: false }
    const api = {
      select: (cols) => { q._select = cols; return api },
      eq: (f, v) => { q._eqs.push([f, v]); return api },
      order: (col) => { q._order = col; return api },
      insert: (row) => { q._insert = row; return api },
      update: (row) => { q._update = row; return api },
      delete: () => { q._delete = true; return api },
      then: (resolve) => {
        Promise.resolve().then(async () => {
          queries.push({ table, eqs: q._eqs.map((e) => [...e]), order: q._order, op: q._insert ? 'insert' : q._update ? 'update' : q._delete ? 'delete' : 'select' })
          let rows = [...store.values()]
          for (const [f, v] of q._eqs) rows = rows.filter((r) => r[f] === v)
          if (q._order) rows = [...rows].sort((x, y) => String(x[q._order]).localeCompare(String(y[q._order])))
          let data = []
          if (q._insert) {
            const row = { ...q._insert, booked: [...(q._insert.booked || [])] }
            store.set(row.id, rowSnap(row))
            push()
            data = [rowSnap(store.get(row.id))]
          } else if (q._update) {
            for (const r of rows) store.set(r.id, rowSnap({ ...r, ...q._update }))
            if (rows.length) push()
            data = rows.map((r) => rowSnap(store.get(r.id)))
          } else if (q._delete) {
            for (const r of rows) store.delete(r.id)
            if (rows.length) push()
            data = rows.map(rowSnap)
          } else {
            data = rows.map(rowSnap)
          }
          resolve({ data, error: null })
        })
      },
    }
    return api
  }

  const sdk = {
    from: (table) => makeBuilder(table),
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, args })
      if (fn !== 'book_turno') return { data: null, error: { message: `rpc desconocida: ${fn}` } }
      const row = store.get(args.turno_id)
      let ok = false
      if (row && row.status !== 'cancelled' && !row.booked.includes(args.user) && row.booked.length < (row.capacity ?? 1)) {
        ok = true
        row.booked = [...row.booked, args.user]
        store.set(row.id, rowSnap(row))
        push()
      }
      return { data: ok, error: null }
    },
    channel: (topic) => {
      const chan = {
        topic,
        _type: null,
        _filter: null,
        _handler: null,
        on: (type, filter, handler) => {
          chan._type = type
          chan._filter = filter
          chan._handler = handler
          return chan
        },
        subscribe: () => {
          channels.push(chan)
          return Promise.resolve('subscribed')
        },
      }
      return chan
    },
    removeChannel: (chan) => {
      const i = channels.indexOf(chan)
      if (i >= 0) channels.splice(i, 1)
    },
  }
  return { sdk, store, rpcCalls, queries }
}

const tick = () => new Promise((r) => setTimeout(r, 0))
const client = () => {
  const fake = fakeSupabase()
  return {
    client: createClient({ provider: 'supabase', supabase: fake.sdk, table: 'turnos' }),
    fake,
  }
}

describe('adaptador supabase', () => {
  it('the registry builds a supabase client with the full contract', () => {
    const c = client().client
    expect(c.provider).toBe('supabase')
    for (const m of ['listTurnos', 'upsertTurno', 'removeTurno', 'bookTurno', 'unbookTurno', 'subscribe']) {
      expect(typeof c[m]).toBe('function')
    }
  })

  it('listTurnos({date}) filters the padded date and returns rows sorted by hour', async () => {
    const { client: c, fake } = client()
    const ts = await c.listTurnos({ date: '2026-11-3' }) // unpadded input
    expect(ts.map((t) => t.id)).toEqual(['cx', 'a1', 'full', 'dup']) // 08:00, 09:00, 10:00, 11:00
    expect(ts[0].durationMin).toBe(30) // snake_case row -> camelCase turn
    expect(ts[0].duration_min).toBeUndefined()
    expect(fake.queries.at(-1)).toEqual({ table: 'turnos', eqs: [['date', '2026-11-03']], order: 'hour', op: 'select' })
  })

  it('listTurnos() without date returns every turn', async () => {
    const { client: c, fake } = client()
    const ts = await c.listTurnos()
    expect(ts.map((t) => t.id).sort()).toEqual(['a1', 'a2', 'cx', 'dup', 'full'])
    expect(fake.queries.at(-1)).toEqual({ table: 'turnos', eqs: [], order: 'hour', op: 'select' })
  })

  it('upsertTurno creates a row with defaults; camelCase maps to snake_case columns', async () => {
    const { client: c, fake } = client()
    const res = await c.upsertTurno({
      title: 'Nuevo', staff: 'Equipo F', hour: '13:30', date: '2026-11-05', durationMin: 45, status: 'pending',
    })
    expect(res.ok).toBe(true)
    expect(typeof res.turn.id).toBe('string')
    expect(res.turn.capacity).toBe(1)
    expect(res.turn.booked).toEqual([])
    const row = fake.store.get(res.turn.id)
    expect(row).toMatchObject({ title: 'Nuevo', duration_min: 45, capacity: 1, status: 'pending' })
    expect(row.durationMin).toBeUndefined()
  })

  it('upsertTurno rejects an invalid new turn and writes nothing', async () => {
    const { client: c, fake } = client()
    const before = fake.store.size
    const res = await c.upsertTurno({})
    expect(res.ok).toBe(false)
    expect(res.errors).toEqual(
      expect.arrayContaining(['El título es obligatorio.', 'La hora debe ser HH:MM.']),
    )
    expect(fake.store.size).toBe(before)
  })

  it('upsertTurno patches via merge, validating the merged record', async () => {
    const { client: c, fake } = client()
    const ok = await c.upsertTurno({ id: 'a1', status: 'confirmed', notes: 'jefes' })
    expect(ok.ok).toBe(true)
    expect(fake.store.get('a1')).toMatchObject({ title: 'Mañana', status: 'confirmed', notes: 'jefes' })
    const bad = await c.upsertTurno({ id: 'a1', status: 'bogus' })
    expect(bad.ok).toBe(false)
    expect(bad.errors).toContain('Estado inválido.')
    expect(fake.store.get('a1').status).toBe('confirmed') // unchanged
  })

  it('removeTurno deletes an existing row and reports absence honestly', async () => {
    const { client: c, fake } = client()
    expect(await c.removeTurno('a2')).toEqual({ ok: true, removed: true })
    expect(fake.store.has('a2')).toBe(false)
    expect(await c.removeTurno('nope')).toEqual({ ok: true, removed: false })
  })

  it('bookTurno calls the atomic RPC and pushes to subscribers', async () => {
    const { client: c, fake } = client()
    const sub = vi.fn()
    c.subscribe(sub)
    await tick()
    const res = await c.bookTurno('a1', 'Elsil')
    expect(res.ok).toBe(true)
    expect(res.turn.booked).toEqual(['Elsil'])
    expect(fake.rpcCalls).toEqual([{ fn: 'book_turno', args: { turno_id: 'a1', user: 'Elsil' } }])
    expect(fake.store.get('a1').booked).toEqual(['Elsil'])
    await tick()
    const last = sub.mock.calls.at(-1)[0]
    expect(last.find((t) => t.id === 'a1').booked).toEqual(['Elsil'])
  })

  it('bookTurno enforces cancelado / duplicado / lleno / inexistente without calling the RPC', async () => {
    const { client: c, fake } = client()
    expect(await c.bookTurno('cx', 'Elsil')).toEqual({ ok: false, error: 'cancelado' })
    expect(await c.bookTurno('dup', 'Elsil')).toEqual({ ok: false, error: 'duplicado' })
    expect(await c.bookTurno('full', 'Elsil')).toEqual({ ok: false, error: 'lleno' })
    expect(await c.bookTurno('nope', 'Elsil')).toEqual({ ok: false, error: 'inexistente' })
    expect(fake.rpcCalls).toHaveLength(0) // guards short-circuit before the RPC
    expect(fake.store.get('cx').booked).toEqual([]) // guards never write
  })

  it('unbookTurno frees the slot; unknown turn -> inexistente', async () => {
    const { client: c, fake } = client()
    const res = await c.unbookTurno('dup', 'Elsil')
    expect(res).toEqual({ ok: true, turn: expect.objectContaining({ id: 'dup', booked: [] }) })
    expect(fake.store.get('dup').booked).toEqual([])
    expect(await c.unbookTurno('nope', 'Elsil')).toEqual({ ok: false, error: 'inexistente' })
  })

  it('subscribe fires immediately, on mutation, and unsubscribe silences it', async () => {
    const { client: c, fake } = client()
    const sub = vi.fn()
    const unsub = c.subscribe(sub)
    await tick()
    expect(sub).toHaveBeenCalledTimes(1) // initial snapshot
    expect(sub.mock.calls[0][0]).toHaveLength(SEED.length)
    await c.upsertTurno({ id: 'a1', notes: 'hola' })
    await tick()
    expect(sub).toHaveBeenCalledTimes(2)
    unsub()
    await fake.sdk.from('turnos').update({ notes: 'adiós' }).eq('id', 'a1')
    await tick()
    expect(sub).toHaveBeenCalledTimes(2) // silenced
  })

  it('rejects a config without the injected supabase client', () => {
    expect(() => createClient({ provider: 'supabase' })).toThrow(/supabase/)
  })
})
