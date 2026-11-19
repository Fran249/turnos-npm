import { bookingDecision, dayKey, normalizeTurn, uid, validateTurno } from '../core/validate.js';

/**
 * Firebase (Firestore) adapter.
 *
 * No top-level `import 'firebase'`: the consumer's generated config
 * (templates/config.turnos.firebase.js) injects the Firestore instance and
 * the SDK functions this adapter calls. That keeps `import 'turnos'` light
 * and makes the adapter testable with a fake SDK surface.
 *
 * Booking integrity (capacity/duplicate/cancelled) is enforced inside a
 * `runTransaction`; Firestore rules cannot express `booked.length < capacity`,
 * so the transaction is the integrity point (see templates/rules/firestore.rules).
 * Dates are stored padded 'YYYY-MM-DD' and compared through dayKey().
 */

/** Padded 'YYYY-MM-DD' from a possibly-unpadded day ('2026-11-3'). */
function paddedDay(dateStr) {
  const [y, m, d] = dayKey(dateStr).split('-');
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function createFirebaseClient(config = {}) {
  const inj = config.firebase;
  if (!inj?.db || !inj?.sdk) {
    throw new Error(
      'Adaptador firebase: falta config.firebase = { db, sdk, collectionName } (se genera con `npx turnos init --firebase`).',
    );
  }
  const { db, sdk } = inj;
  const name = inj.collectionName || 'turnos';

  const docsToTurns = (docs) =>
    (docs || [])
      .filter((d) => d && d.exists)
      .map((d) => normalizeTurn({ id: d.id, ...d.data() }));

  async function getTurn(id) {
    const snap = await sdk.getDoc(sdk.doc(db, name, id));
    return snap.exists ? normalizeTurn({ id, ...snap.data() }) : null;
  }

  return {
    provider: 'firebase',

    async listTurnos({ date } = {}) {
      const q = date
        ? sdk.query(sdk.collection(db, name), sdk.where('date', '==', paddedDay(date)))
        : sdk.collection(db, name);
      const snap = await sdk.getDocs(q);
      return docsToTurns(snap.docs);
    },

    async upsertTurno(input = {}) {
      if (input.id) {
        const actual = await getTurn(input.id);
        if (!actual) return { ok: false, errors: ['El turno ya no existe.'] };
        const merged = { ...actual, ...input, id: actual.id };
        const errors = validateTurno(merged);
        if (errors.length > 0) return { ok: false, errors };
        const turn = normalizeTurn(merged);
        await sdk.updateDoc(sdk.doc(db, name, actual.id), turn);
        return { ok: true, turn };
      }
      const errors = validateTurno(input);
      if (errors.length > 0) return { ok: false, errors };
      const id = uid();
      const turn = normalizeTurn({ ...input, id });
      await sdk.setDoc(sdk.doc(db, name, id), turn);
      return { ok: true, turn };
    },

    async removeTurno(id) {
      const exists = (await getTurn(id)) !== null;
      if (exists) await sdk.deleteDoc(sdk.doc(db, name, id));
      return { ok: true, removed: exists };
    },

    async bookTurno(id, user) {
      return sdk.runTransaction(async (t) => {
        const ref = sdk.doc(db, name, id);
        const snap = await t.get(ref);
        const base = snap.exists ? normalizeTurn({ id, ...snap.data() }) : null;
        const problem = bookingDecision(base, user);
        if (problem) return { ok: false, error: problem };
        const booked = [...base.booked, user];
        await t.update(ref, { booked });
        return { ok: true, turn: normalizeTurn({ ...base, booked }) };
      });
    },

    async unbookTurno(id, user) {
      const turn = await getTurn(id);
      if (!turn) return { ok: false, error: 'inexistente' };
      const booked = (turn.booked || []).filter((u) => u !== user);
      await sdk.updateDoc(sdk.doc(db, name, id), { booked });
      return { ok: true, turn: normalizeTurn({ ...turn, booked }) };
    },

    subscribe(cb) {
      return sdk.onSnapshot(sdk.collection(db, name), (snap) => cb(docsToTurns(snap.docs)));
    },
  };
}
