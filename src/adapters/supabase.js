import { bookingDecision, dayKey, normalizeTurn, uid, validateTurno } from '../core/validate.js';

/**
 * Supabase (Postgres + PostgREST + realtime) adapter.
 *
 * No top-level `import '@supabase/supabase-js'`: the consumer's generated
 * config (templates/config.turnos.supabase.js) injects the supabase client
 * and the table name. That keeps `import 'turnos'` light and makes the
 * adapter testable with a fake client surface.
 *
 * The table is snake_case (`duration_min`, `created_at`, ...) while the
 * turn schema is camelCase — rows are mapped both ways in this adapter.
 *
 * Booking integrity: the SQL function `public.book_turno(turno_id, user)`
 * (templates/sql/0001_turnos.sql) takes a row lock (`for update`) and
 * enforces cancelled/duplicate/capacity server-side, returning a boolean.
 * This adapter pre-checks the guards locally to surface the exact error
 * code, calls the RPC as the atomic integrity point, and re-validates the
 * row when the RPC declines (a concurrent book may have filled the slot).
 * There is no unbook RPC: unbookTurno is a client-side update.
 */

/** Padded 'YYYY-MM-DD' from a possibly-unpadded day ('2026-11-3'). */
function paddedDay(dateStr) {
  const [y, m, d] = dayKey(dateStr).split('-');
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** snake_case row -> camelCase turn (drops DB bookkeeping columns). */
function rowToTurn(row) {
  const { duration_min, created_at, updated_at, ...rest } = row;
  return normalizeTurn({ ...rest, durationMin: duration_min });
}

/** camelCase turn -> snake_case row payload. */
function turnToRow(turn) {
  const { durationMin, ...rest } = turn;
  return { ...rest, duration_min: durationMin };
}

export function createSupabaseClient(config = {}) {
  const sdk = config.supabase;
  if (!sdk) {
    throw new Error(
      'Adaptador supabase: falta config.supabase (cliente @supabase/supabase-js) y config.table ' +
        '(se generan con `npx turnos init --supabase`).',
    );
  }
  const name = config.table || 'turnos';

  async function getTurn(id) {
    const { data, error } = await sdk.from(name).select('*').eq('id', id);
    if (error) throw new Error(`supabase: ${error.message}`);
    if (!data || data.length === 0) return null;
    return rowToTurn(data[0]);
  }

  async function loadAll() {
    const { data, error } = await sdk.from(name).select('*').order('hour');
    if (error) throw new Error(`supabase: ${error.message}`);
    return (data || []).map(rowToTurn);
  }

  return {
    provider: 'supabase',

    async listTurnos({ date } = {}) {
      if (date) {
        const { data, error } = await sdk.from(name).select('*').eq('date', paddedDay(date)).order('hour');
        if (error) throw new Error(`supabase: ${error.message}`);
        return (data || []).map(rowToTurn);
      }
      return loadAll();
    },

    async upsertTurno(input = {}) {
      const now = new Date().toISOString();
      if (input.id) {
        const actual = await getTurn(input.id);
        if (!actual) return { ok: false, errors: ['El turno ya no existe.'] };
        const merged = { ...actual, ...input, id: actual.id };
        const errors = validateTurno(merged);
        if (errors.length > 0) return { ok: false, errors };
        const payload = turnToRow(normalizeTurn(merged));
        delete payload.id; // PostgREST: never update the primary key
        payload.updated_at = now;
        const { error } = await sdk.from(name).update(payload).eq('id', actual.id);
        if (error) throw new Error(`supabase: ${error.message}`);
        return { ok: true, turn: normalizeTurn(merged) };
      }
      const errors = validateTurno(input);
      if (errors.length > 0) return { ok: false, errors };
      const turn = normalizeTurn({ ...input, id: uid() });
      const payload = { ...turnToRow(turn), created_at: now, updated_at: now };
      const { error } = await sdk.from(name).insert(payload);
      if (error) throw new Error(`supabase: ${error.message}`);
      return { ok: true, turn };
    },

    async removeTurno(id) {
      const { data, error } = await sdk.from(name).delete().eq('id', id).select('id');
      if (error) throw new Error(`supabase: ${error.message}`);
      return { ok: true, removed: (data?.length ?? 0) > 0 };
    },

    async bookTurno(id, user) {
      const current = await getTurn(id);
      if (!current) return { ok: false, error: 'inexistente' };
      const early = bookingDecision(current, user);
      if (early) return { ok: false, error: early };
      const { data: booked, error } = await sdk.rpc('book_turno', { turno_id: id, user });
      if (error) throw new Error(`supabase rpc book_turno: ${error.message}`);
      if (!booked) {
        // Concurrent book won the race: re-read and surface the real reason.
        const fresh = await getTurn(id);
        return { ok: false, error: bookingDecision(fresh, user) || 'lleno' };
      }
      const turn = await getTurn(id);
      return { ok: true, turn };
    },

    async unbookTurno(id, user) {
      const turn = await getTurn(id);
      if (!turn) return { ok: false, error: 'inexistente' };
      const booked = (turn.booked || []).filter((u) => u !== user);
      const { error } = await sdk
        .from(name)
        .update({ booked, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(`supabase: ${error.message}`);
      return { ok: true, turn: normalizeTurn({ ...turn, booked }) };
    },

    subscribe(cb) {
      const reload = async () => {
        const turns = await loadAll();
        cb(turns);
      };
      const channel = sdk
        .channel(`turnos:${name}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: name }, reload);
      channel.subscribe();
      reload(); // initial delivery
      return () => sdk.removeChannel(channel);
    },
  };
}
