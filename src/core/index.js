import { createMemoryClient } from './memory.js';
import { createFirebaseClient } from '../adapters/firebase.js';
import { createSupabaseClient } from '../adapters/supabase.js';

export {
  validateTurno, normalizeTurn, bookingDecision,
  STATUSES, PRIORITIES, todayKey, dayKey, uid,
} from './validate.js';
export { createMemoryClient } from './memory.js';
export { createFirebaseClient } from '../adapters/firebase.js';
export { createSupabaseClient } from '../adapters/supabase.js';

/**
 * Provider registry. 'memory' is the built-in backend; 'firebase' and
 * 'supabase' receive their SDK objects from the consumer's generated config
 * file, so importing `turnos` never pulls in a heavy SDK.
 */
export function createClient(config = {}) {
  switch (config.provider) {
    case 'memory':
    case undefined:
      return createMemoryClient(config);
    case 'firebase':
      return createFirebaseClient(config);
    case 'supabase':
      return createSupabaseClient(config);
    default:
      throw new Error(
        `proveedor desconocido: "${config.provider}". Usa 'firebase', 'supabase' o 'memory'.`,
      );
  }
}
