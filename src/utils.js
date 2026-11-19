export const STATUS_LABELS = { pending: 'Pendiente', confirmed: 'Confirmado', completed: 'Completado', cancelled: 'Cancelado' };
export const PRIORITY_LABELS = { low: 'Baja', medium: 'Media', high: 'Alta' };
export const WEEK_SHORT = ['L','M','X','J','V','S','D'];
export const DIA_LARGO = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
export const MES_LARGO = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

/**
 * Color tokens live in index.css as three-layer design-system CSS variables
 * (primitive → semantic, per the "design-system" skill). The CSS variables
 * hold HSL *triples* (so Tailwind can wrap with <alpha-value> for opacity).
 * When a component needs a raw CSS color (inline style attribute), wrap the
 * semantic variable in hsl(). No raw hex anywhere.
 */
export const STATUS_COLOR = {
  pending:    'hsl(var(--status-pending))',
  confirmed:  'hsl(var(--status-confirmed))',
  completed:  'hsl(var(--status-completed))',
  cancelled:  'hsl(var(--status-cancelled))',
};
export const PRIORITY_COLOR = {
  low:    'hsl(var(--priority-low))',
  medium: 'hsl(var(--priority-medium))',
  high:   'hsl(var(--priority-high))',
};

export function cn() { return ''; } // kept for compatibility; not used

export function parseTurnDate(str) {
  const parts = String(str || '').split('-');
  if (parts.length !== 3) return new Date();
  const [y,m,d] = parts.map(Number);
  if (Number.isNaN(y)) return new Date();
  return new Date(y, m-1, d);
}

export function compareByDate(a, b) { return parseTurnDate(a.date) - parseTurnDate(b.date); }

export function todayKey() {
  return `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`;
}

export function dayKey(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  return `${y}-${m}-${d}`;
}

/** '2026-11-13' → 'Jueves, 13 de noviembre' (fecha local, sin salto UTC). */
export function fechaLarga(dateStr) {
  const d = parseTurnDate(dateStr || todayKey());
  return `${DIA_LARGO[d.getDay()]}, ${d.getDate()} de ${MES_LARGO[d.getMonth()]}`;
}

/** Date → 'noviembre 2026', para el encabezado del calendario. */
export function mesLargo(date) {
  return `${MES_LARGO[date.getMonth()]} ${date.getFullYear()}`;
}

/** Date → '2026-11-13' (clave ISO local, sin pasar por UTC). */
export function isoKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
