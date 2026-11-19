import { Store, persist, remove as removeFromStore } from './store.js'
import { normalizeTurn, validateTurno, bookingDecision, uid, dayKey } from './core/validate.js'

/**
 * The demo's `turnos` client, implemented over the app's localStorage store.
 *
 * Why: the demo app already owns a rich store (`Store()`) that the calendar,
 * the week strip and the register read directly. The generated components
 * (`TurnoPicker`, `TurnoAdmin`) only know the provider-agnostic client
 * contract. This adapter bridges the two, so every surface — agenda and
 * admin — reads and writes the SAME turns. Booking in /user updates the
 * calendar; creating in /admin shows up in /user, no reload.
 *
 * It is demo-only glue. Consumers of the package pass their own client.
 */
const clone = (turn) => ({ ...turn, booked: [...(turn.booked || [])] })

/** Current turns, normalized and detached from the store's cache. */
const snapshot = () => Store().map((t) => normalizeTurn(clone(t)))

export function createLocalClient() {
  const listeners = new Set()

  function emit() {
    const turns = snapshot()
    for (const cb of [...listeners]) cb(turns)
  }

  return {
    provider: 'local',

    async listTurnos({ date } = {}) {
      const turns = snapshot()
      return date ? turns.filter((t) => dayKey(t.date) === dayKey(date)) : turns
    },

    async upsertTurno(input) {
      // Merge into the live store entry: a patch like { id, status } must not
      // wipe the rest of the turn, and a new turn must get its id up front.
      const list = Store()
      const idx = list.findIndex((t) => t.id === input.id)
      const candidate = idx >= 0 ? { ...list[idx], ...input } : { ...input }

      const errors = validateTurno(candidate)
      if (errors.length > 0) return { ok: false, errors }

      const now = Date.now()
      const turn = normalizeTurn({ ...candidate, id: candidate.id || uid() })
      if (idx >= 0) list[idx] = { ...turn, updatedAt: now }
      else list.push({ ...turn, createdAt: now, updatedAt: now })

      persist()
      emit()
      return { ok: true, turn: normalizeTurn(clone(turn)) }
    },

    async removeTurno(id) {
      const before = Store().length
      removeFromStore(id)
      const removed = Store().length < before
      if (removed) emit()
      return { ok: true, removed }
    },

    async bookTurno(turnId, user) {
      const turn = Store().find((t) => t.id === turnId)
      const problem = bookingDecision(turn, user)
      if (problem) return { ok: false, error: problem }

      turn.booked = [...(turn.booked || []), user]
      persist()
      emit()
      return { ok: true, turn: clone(turn) }
    },

    async unbookTurno(turnId, user) {
      const turn = Store().find((t) => t.id === turnId)
      if (!turn) return { ok: false, error: 'inexistente' }

      turn.booked = (turn.booked || []).filter((u) => u !== user)
      persist()
      emit()
      return { ok: true, turn: clone(turn) }
    },

    subscribe(cb) {
      listeners.add(cb)
      cb(snapshot())
      return () => listeners.delete(cb)
    },
  }
}
