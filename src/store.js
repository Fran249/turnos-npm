// localStorage-backed turn store
import { addDays } from 'date-fns';

const STORAGE_KEY = 'turnos:turns:v1';

export const PRIORITIES = ['low', 'medium', 'high'];
export const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function defaults() {
  const t = new Date();
  return [
    { id: uid(), title: 'Consulta de rutina', staff: 'Dra. Elena Vidal', hour: '09:00', durationMin: 25, capacity: 1, priority: 'medium', notes: 'Control anual.', status: 'confirmed', date: fmtDate(t) },
    { id: uid(), title: 'Control de presión', staff: 'Enf. Marcos Ruiz', hour: '11:30', durationMin: 15, capacity: 3, booked: ['Ana', 'Leo'], priority: 'low', notes: '', status: 'confirmed', date: fmtDate(t) },
    { id: uid(), title: 'Vacunación grupo 4', staff: 'Equipo B', hour: '14:00', durationMin: 60, capacity: 4, booked: ['Sofía'], priority: 'high', notes: '25 personas pendientes.', status: 'confirmed', date: fmtDate(t) },
    { id: uid(), title: 'Cierre de caja', staff: 'Jefe de oficina', hour: '18:30', durationMin: 30, capacity: 1, booked: ['Otro'], priority: 'medium', notes: '', status: 'pending', date: fmtDate(t) },
    { id: uid(), title: 'Apertura de consultorio', staff: 'Equipo A', hour: '08:30', durationMin: 30, capacity: 2, priority: 'medium', notes: '', status: 'pending', date: fmtDate(addDays(t, 1)) },
    { id: uid(), title: 'Taller de coordinación', staff: 'Sra. Martínez', hour: '15:00', durationMin: 90, capacity: 6, priority: 'high', notes: 'Se reprograma la semana próxima.', status: 'cancelled', date: fmtDate(addDays(t, 1)) },
    { id: uid(), title: 'Check-in administrativo', staff: 'Elena Vidal', hour: '10:15', durationMin: 15, capacity: 1, booked: ['Ana'], priority: 'low', notes: '', status: 'completed', date: fmtDate(addDays(t, -1)) },
  ];
}

let cache = null;

function load() {
  if (cache !== null) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      cache = Array.isArray(p) && p.length > 0 ? p : defaults();
    } else {
      cache = defaults();
    }
  } catch {
    cache = defaults();
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  return cache;
}

export const Store = () => { if (!cache) load(); return cache; };

export function persist() {
  if (cache) localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

/** Test hook: drop the module-level cache so the next read re-seeds from localStorage. */
export function __resetStoreForTests() {
  cache = null;
}

export function upsert(turn) {
  const list = [...load()];
  const idx = list.findIndex((t) => t.id === turn.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...turn, updatedAt: Date.now() };
  else list.push({ ...turn, id: turn.id || uid(), createdAt: Date.now(), updatedAt: Date.now() });
  cache = list;
  persist();
  return cache;
}

export function remove(id) {
  cache = load().filter((t) => t.id !== id);
  persist();
  return cache;
}

export function validateNew(input) {
  const errors = [];
  if (!input.title || !input.title.trim()) errors.push('El título es obligatorio.');
  if (!input.staff || !input.staff.trim()) errors.push('El personal es obligatorio.');
  const [h, m] = input.hour.split(':').map(Number);
  if (!input.hour || Number.isNaN(h) || h < 0 || h > 23 || Number.isNaN(m) || m < 0 || m > 59)
    errors.push('La hora debe ser HH:MM.');
  if (Number.isNaN(input.durationMin) || input.durationMin < 10) errors.push('La duración debe ser ≥ 10 min.');
  if (!PRIORITIES.includes(input.priority)) errors.push('Prioridad inválida.');
  return errors;
}

export function fmtDateExport(d) { return fmtDate(d); }
export const fmtDateAlias = fmtDate;

