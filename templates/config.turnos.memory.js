// Generado por `npx turnos init --memory` (turnos v0.3.1).
// Modo demo sin base de datos: usa el adaptador en memoria integrado.
// Los turnos se visualizan pero NO se pueden reservar ni crear hasta que
// cambies a Firebase o Supabase.
// Para cambiar de proveedor, edita este archivo y ejecuta:
//   npx turnos init --firebase   (o --supabase)
import { createClient } from 'turnos'

export const turnos = createClient({
  provider: 'memory',
  readOnly: true,
  turns: [
    {
      id: 'demo-1',
      title: 'Consulta médica general',
      staff: 'Dr. García',
      date: '2026-11-20',
      hour: '09:00',
      durationMin: 30,
      capacity: 1,
      priority: 'medium',
      status: 'pending',
      notes: 'Chequeo anual de rutina',
      booked: [],
    },
    {
      id: 'demo-2',
      title: 'Limpieza dental',
      staff: 'Dra. López',
      date: '2026-11-20',
      hour: '10:30',
      durationMin: 45,
      capacity: 1,
      priority: 'low',
      status: 'pending',
      notes: 'Limpieza profiláctica',
      booked: [],
    },
    {
      id: 'demo-3',
      title: 'Revisión de vista',
      staff: 'Dr. Méndez',
      date: '2026-11-20',
      hour: '14:00',
      durationMin: 20,
      capacity: 2,
      priority: 'high',
      status: 'pending',
      notes: 'Control de graduación',
      booked: [],
    },
  ],
})
