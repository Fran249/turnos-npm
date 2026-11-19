import { describe, it, expect, vi } from 'vitest'
import { createClient } from '../core/index.js'

/**
 * Contract tests for the Firebase adapter (src/adapters/firebase.js).
 *
 * The package never imports the `firebase` npm package at top level: the
 * generated consumer config (`templates/config.turnos.firebase.js`) injects
 * `db` + the SDK functions the adapter needs. This fake reproduces that
 * injected surface (collection/query/where/getDocs/getDoc/doc/setDoc/
 * updateDoc/deleteDoc/runTransaction/onSnapshot) over an in-memory store,
 * so we can assert both call shape and results.
 *
 * Intended RED: the registry only knows 'memory' — every test below fails
 * with "proveedor desconocido: firebase" until stage 4 lands.
 */

const SEED = [
  { id: 'a1', title: 'Mañana', staff: 'Equipo A', hour: '09:00', date: '2026-11-03', status: 'confirmed', booked: [] },
  { id: 'a2', title: 'Tarde', staff: 'Equipo B', hour: '16:00', date: '2026-11-04', status: 'pending' },
  { id: 'cx', title: 'Cancelado', staff: 'C', hour: '08:00', date: '2026-11-03', status: 'cancelled', booked: [] },
  { id: 'full', title: 'Lleno', staff: 'D', hour: '10:00', date: '2026-11-03', status: 'confirmed', capacity: 1, booked: ['Otro'] },
  { id: 'dup', title: 'Ya elegí', staff: 'E', hour: '11:00', date: '2026-11-03', status: 'confirmed', capacity: 2, booked: ['Elsil'] },
]

function fakeFirebase(seed = SEED) {
  const store = new Map(seed.map((t) => [t.id, { ...t, booked: [...(t.booked || [])] }]))
  const handlers = new Set()
  const allDocs = () =>
    [...store.entries()].map(([id, data]) => ({ id, exists: true, data: () => ({ ...data }) }))
  // Mirror Firestore: listeners are pushed server-side after each mutation.
  const push = () =>
    queueMicrotask(() => {
      const snap = { docs: allDocs() }
      for (const h of [...handlers]) h(snap)
    })
  const docSnap = (id) =>
    store.has(id)
      ? { id, exists: true, data: () => ({ ...store.get(id) }) }
      : { id, exists: false, data: () => undefined }

  const sdk = {
    whereCalls: [],
    collection: (_db, name) => ({ kind: 'collection', name }),
    query: (coll, ...conds) => ({ ...coll, conds }),
    where: (field, op, value) => {
      sdk.whereCalls.push({ field, op, value })
      return { field, op, value }
    },
    getDocs: async (q) => {
      let ids = [...store.keys()]
      for (const c of q.conds || []) ids = ids.filter((id) => store.get(id)[c.field] === c.value)
      return { docs: ids.map((id) => docSnap(id)) }
    },
    getDoc: async (ref) => docSnap(ref.id),
    doc: (_db, name, id) => ({ kind: 'doc', name, id }),
    setDoc: async (ref, data) => {
      store.set(ref.id, { ...data })
      push()
    },
    updateDoc: async (ref, data) => {
      store.set(ref.id, { ...store.get(ref.id), ...data })
      push()
    },
    deleteDoc: async (ref) => {
      store.delete(ref.id)
      push()
    },
    runTransaction: async (fn) =>
      fn({
        get: (ref) => sdk.getDoc(ref),
        update: (ref, data) => sdk.updateDoc(ref, data),
      }),
    onSnapshot: (_coll, cb) => {
      handlers.add(cb)
      queueMicrotask(() => cb({ docs: allDocs() }))
      return () => handlers.delete(cb)
    },
  }
  return { sdk, store }
}

const tick = () => new Promise((r) => setTimeout(r, 0))
const client = () => {
  const fake = fakeFirebase()
  return {
    client: createClient({
      provider: 'firebase',
      firebase: { db: { __fake: true }, sdk: fake.sdk, collectionName: 'turnos' },
    }),
    fake,
  }
}

describe('adaptador firebase', () => {
  it('the registry builds a firebase client with the full contract', () => {
    const c = client().client
    expect(c.provider).toBe('firebase')
    for (const m of ['listTurnos', 'upsertTurno', 'removeTurno', 'bookTurno', 'unbookTurno', 'subscribe']) {
      expect(typeof c[m]).toBe('function')
    }
  })

  it('listTurnos({date}) queries the padded date via dayKey normalization', async () => {
    const { client: c, fake } = client()
    const ts = await c.listTurnos({ date: '2026-11-3' }) // unpadded input
    expect(ts.map((t) => t.id).sort()).toEqual(['a1', 'cx', 'dup', 'full'])
    expect(fake.sdk.whereCalls).toContainEqual({ field: 'date', op: '==', value: '2026-11-03' })
  })

  it('listTurnos() without date returns every turn', async () => {
    const { client: c } = client()
    expect((await c.listTurnos()).length).toBe(SEED.length)
  })

  it('upsertTurno creates a turn with defaults; the doc id carries the turn id', async () => {
    const { client: c, fake } = client()
    const res = await c.upsertTurno({
      title: 'Nuevo', staff: 'Equipo F', hour: '13:30', date: '2026-11-05', status: 'pending',
    })
    expect(res.ok).toBe(true)
    expect(typeof res.turn.id).toBe('string')
    expect(res.turn.capacity).toBe(1)
    expect(res.turn.booked).toEqual([])
    expect(fake.store.get(res.turn.id).title).toBe('Nuevo')
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

  it('removeTurno deletes an existing doc and reports absence honestly', async () => {
    const { client: c, fake } = client()
    expect(await c.removeTurno('a2')).toEqual({ ok: true, removed: true })
    expect(fake.store.has('a2')).toBe(false)
    expect(await c.removeTurno('nope')).toEqual({ ok: true, removed: false })
  })

  it('bookTurno appends the user inside a transaction and pushes to subscribers', async () => {
    const { client: c, fake } = client()
    const sub = vi.fn()
    c.subscribe(sub)
    await tick()
    const res = await c.bookTurno('a1', 'Elsil')
    expect(res.ok).toBe(true)
    expect(res.turn.booked).toEqual(['Elsil'])
    expect(fake.store.get('a1').booked).toEqual(['Elsil'])
    await tick()
    const last = sub.mock.calls.at(-1)[0]
    expect(last.find((t) => t.id === 'a1').booked).toEqual(['Elsil'])
  })

  it('bookTurno enforces cancelado / duplicado / lleno / inexistente', async () => {
    const { client: c, fake } = client()
    expect(await c.bookTurno('cx', 'Elsil')).toEqual({ ok: false, error: 'cancelado' })
    expect(await c.bookTurno('dup', 'Elsil')).toEqual({ ok: false, error: 'duplicado' })
    expect(await c.bookTurno('full', 'Elsil')).toEqual({ ok: false, error: 'lleno' })
    expect(await c.bookTurno('nope', 'Elsil')).toEqual({ ok: false, error: 'inexistente' })
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
    await fake.sdk.updateDoc(fake.sdk.doc(null, 'turnos', 'a1'), { notes: 'hola' })
    await tick()
    expect(sub).toHaveBeenCalledTimes(2)
    unsub()
    await fake.sdk.updateDoc(fake.sdk.doc(null, 'turnos', 'a1'), { notes: 'adiós' })
    await tick()
    expect(sub).toHaveBeenCalledTimes(2) // silenced
  })

  it('rejects a config without the injected firebase object', () => {
    expect(() => createClient({ provider: 'firebase' })).toThrow(/firebase/)
  })
})
