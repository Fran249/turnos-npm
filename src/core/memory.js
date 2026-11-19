import { uid, dayKey, normalizeTurn, validateTurno, bookingDecision } from './validate.js';

/**
 * In-memory adapter: the reference implementation of the provider-agnostic
 * client contract. Pure (no localStorage/network) so it works in tests,
 * SSR and as the default `createClient()` backend. Mutation semantics
 * (merge upsert, timestamps) are ported from the demo app's src/store.js.
 *
 * Client contract implemented here:
 *   provider                 'memory'
 *   listTurnos({date})       normalized turns; date filter goes through dayKey()
 *   upsertTurno(input)       { ok, turn } | { ok: false, errors } (validation on the merge)
 *   removeTurno(id)         { ok, removed }
 *   bookTurno(id, user)     { ok, turn } | { ok: false, error: 'lleno'|'cancelado'|'duplicado'|'inexistente' }
 *   unbookTurno(id, user)   { ok, turn } | { ok: false, error: 'inexistente' }
 *   subscribe(cb)            cb(turns[]) fires immediately, then on every mutation; returns unsubscribe()
 */
export function createMemoryClient(config = {}) {
  const { turns: seed = [], readOnly = false } = config;
  // Seeded turns may arrive without an id (a hand-written demo seed, a CSV
  // import). Every turn needs one: it is the React key of the generated
  // lists and the handle for bookTurno/upsertTurno/removeTurno.
  let state = seed.map((t) => normalizeTurn({ ...t, id: t.id || uid() }));
  const listeners = new Set();

  function emit() {
    const snapshot = state.map((t) => ({ ...t, booked: [...(t.booked || [])] }));
    for (const cb of [...listeners]) cb(snapshot);
  }

  // When readOnly is true (demo mode, no real database configured), the
  // adapter still exposes turns for visualization but refuses any write.
  function denyWrite() {
    return { ok: false, error: 'read-only' };
  }

  return {
    provider: 'memory',
    readOnly,

    async listTurnos({ date } = {}) {
      const all = state.map(normalizeTurn);
      return date ? all.filter((t) => dayKey(t.date) === dayKey(date)) : all;
    },

    async upsertTurno(input) {
      if (readOnly) return denyWrite();
      const idx = state.findIndex((t) => t.id === input.id);
      const candidate = idx >= 0 ? { ...state[idx], ...input } : { ...input };
      const errors = validateTurno(candidate);
      if (errors.length > 0) return { ok: false, errors };
      const now = Date.now();
      const turn = normalizeTurn({ ...candidate, id: candidate.id || uid() });
      const target = idx >= 0 ? idx : state.length;
      if (idx >= 0) state[idx] = { ...turn, updatedAt: now };
      else state.push({ ...turn, createdAt: now, updatedAt: now });
      emit();
      return { ok: true, turn: normalizeTurn(state[target]) };
    },

    async removeTurno(id) {
      if (readOnly) return denyWrite();
      const before = state.length;
      state = state.filter((t) => t.id !== id);
      const removed = state.length < before;
      if (removed) emit();
      return { ok: true, removed };
    },

    async bookTurno(turnId, user) {
      if (readOnly) return denyWrite();
      const turn = state.find((t) => t.id === turnId);
      const problem = bookingDecision(turn, user);
      if (problem) return { ok: false, error: problem };
      turn.booked = [...(turn.booked || []), user];
      emit();
      return { ok: true, turn: { ...turn, booked: [...turn.booked] } };
    },

    async unbookTurno(turnId, user) {
      if (readOnly) return denyWrite();
      const turn = state.find((t) => t.id === turnId);
      if (!turn) return { ok: false, error: 'inexistente' };
      turn.booked = (turn.booked || []).filter((u) => u !== user);
      emit();
      return { ok: true, turn: { ...turn, booked: [...turn.booked] } };
    },

    subscribe(cb) {
      listeners.add(cb);
      cb(state.map((t) => ({ ...t, booked: [...(t.booked || [])] })));
      return () => listeners.delete(cb);
    },
  };
}
