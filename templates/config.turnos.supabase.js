// Generado por `npx turnos init --supabase` (turnos v{{TURNOS_VERSION}}).
// 1) Instala el cliente:  npm i @supabase/supabase-js
// 2) Reemplaza URL y ANON KEY (Supabase Dashboard → Project Settings → API).
// 3) Ejecuta la migración: supabase-migrations/0001_turnos.sql
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from 'turnos'

const supabase = createSupabaseClient(
  'https://TU_ORG.supabase.co', // ← reemplazar por tu URL
  'TU_ANON_KEY',               // ← reemplazar por tu anon key
)

// Cliente del paquete `turnos` — mismo contrato para todos los proveedores:
// listTurnos / upsertTurno / removeTurno / bookTurno / unbookTurno / subscribe
export const turnos = createClient({
  provider: 'supabase',
  supabase,
  table: 'turnos',
})
