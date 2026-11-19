/**
 * Package-level domain rules for `turnos` (the npm turnero).
 * Source of truth shared by every provider adapter and by the generated
 * UI components. Error messages mirror the Spanish style of the demo
 * app's src/store.js#validateNew so consumers see a consistent surface.
 */
export const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
export const PRIORITIES = ['low', 'medium', 'high'];

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Padded ISO today, e.g. `2026-11-11`. */
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Unpadded date key (`2026-11-03` -> `2026-11-3`). Providers store padded
 * dates while UI calendars may emit unpadded keys — every date comparison
 * must normalize both sides through dayKey() (same fix as ScheduleView).
 */
export function dayKey(dateStr) {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  return [y, m, d].join('-');
}

/** Shared booking semantics across providers. Returns null when bookable. */
export function bookingDecision(turn, user) {
  if (!turn) return 'inexistente';
  if (turn.status === 'cancelled') return 'cancelado';
  const booked = turn.booked || [];
  if (booked.includes(user)) return 'duplicado';
  if (booked.length >= (turn.capacity ?? 1)) return 'lleno';
  return null;
}

/** Fill defaults without mutating the input. */
export function normalizeTurn(raw) {
  const t = { ...raw };
  t.capacity = t.capacity ?? 1;
  t.booked = Array.isArray(t.booked) ? [...t.booked] : [];
  if (t.status === undefined) t.status = 'pending';
  if (t.durationMin === undefined || t.durationMin === null || t.durationMin === '') t.durationMin = 30;
  if (t.priority === undefined) t.priority = 'medium';
  if (t.notes === undefined) t.notes = '';
  return t;
}

/**
 * Validate a turn to be created or updated. Returns a list of error strings
 * (empty = valid). Absent optional fields are not errors — they get
 * defaults in normalizeTurn().
 */
export function validateTurno(input) {
  const errors = [];
  if (!input.title || !input.title.trim()) errors.push('El título es obligatorio.');
  if (!input.staff || !input.staff.trim()) errors.push('El personal es obligatorio.');
  const [h, m] = String(input.hour ?? '').split(':').map(Number);
  if (!input.hour || Number.isNaN(h) || h < 0 || h > 23 || Number.isNaN(m) || m < 0 || m > 59) {
    errors.push('La hora debe ser HH:MM.');
  }
  if (input.durationMin !== undefined && input.durationMin !== null && input.durationMin !== '' &&
      (Number.isNaN(input.durationMin) || input.durationMin < 10)) {
    errors.push('La duración debe ser ≥ 10 min.');
  }
  if (input.priority !== undefined && !PRIORITIES.includes(input.priority)) {
    errors.push('Prioridad inválida.');
  }
  if (input.status !== undefined && !STATUSES.includes(input.status)) {
    errors.push('Estado inválido.');
  }
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    errors.push('La fecha debe ser YYYY-MM-DD.');
  }
  if (input.capacity !== undefined && (!Number.isInteger(input.capacity) || input.capacity < 1)) {
    errors.push('La capacidad debe ser un entero ≥ 1.');
  }
  return errors;
}
