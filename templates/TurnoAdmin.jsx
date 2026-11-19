import { useEffect, useState } from 'react'
import './turnos.css'

/**
 * TurnoAdmin — el administrador controla los turnos: crea, cambia su
 * estado y elimina. Generado por `npx turnos init` (turnos v0.1.0).
 *
 * Uso:
 *   import { turnos } from './turnos/turnos.config'
 *   import TurnoAdmin from './turnos/TurnoAdmin'
 *   <TurnoAdmin adapter={turnos} />
 *
 * Props:
 *   - adapter: cliente `turnos` (el que exporta turnos.config.js).
 *   - titulo?: texto del encabezado (default 'Administrar turnos').
 *
 * Funciona con el adaptador que sea (Firebase, Supabase o 'memory'):
 * solo usa upsertTurno / removeTurno / subscribe del contrato.
 */
const ESTADOS = [
  ['pending', 'Pendiente'],
  ['confirmed', 'Confirmado'],
  ['completed', 'Completado'],
  ['cancelled', 'Cancelado'],
]
const PRIORIDADES = [
  ['low', 'Baja'],
  ['medium', 'Media'],
  ['high', 'Alta'],
]

const FORM_VACIO = {
  title: '', staff: '', date: '', hour: '', durationMin: '', capacity: '', priority: 'medium', notes: '',
}

function hoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** '2026-11-11' → 'Lunes, 11 de noviembre' (fecha local, sin salto UTC). */
function fechaBonita(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  const texto = new Date(y, m - 1, d).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export default function TurnoAdmin({ adapter, titulo = 'Administrar turnos' }) {
  const readOnly = adapter.readOnly === true
  const [turnos, setTurnos] = useState([])
  const [form, setForm] = useState({ ...FORM_VACIO, date: hoy() })
  const [errores, setErrores] = useState([])
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    const ordenar = (ts) => [...ts].sort((a, b) => a.date.localeCompare(b.date) || a.hour.localeCompare(b.hour))
    const un = adapter.subscribe((ts) => setTurnos(ordenar(ts)))
    return un
  }, [adapter])

  function cambiar(e) {
    if (readOnly) return
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  async function crear(e) {
    e.preventDefault()
    if (readOnly) {
      setAviso('Configura Firebase o Supabase para crear turnos.')
      return
    }
    setOcupado(true)
    setErrores([])
    setAviso('')
    const res = await adapter.upsertTurno({
      title: form.title,
      staff: form.staff,
      date: form.date,
      hour: form.hour,
      durationMin: form.durationMin ? Number(form.durationMin) : undefined,
      capacity: form.capacity ? Number(form.capacity) : undefined,
      priority: form.priority,
      status: 'pending',
      notes: form.notes,
    })
    if (res.ok) {
      setForm({ ...FORM_VACIO, date: hoy() })
      setAviso('Turno creado.')
    } else {
      setErrores(res.errors || ['No se pudo crear el turno.'])
    }
    setOcupado(false)
  }

  async function cambiarEstado(t, status) {
    if (readOnly) return
    const res = await adapter.upsertTurno({ id: t.id, status })
    if (!res.ok) setAviso(`Sin cambios en "${t.title}": ${(res.errors || []).join(' ')}`)
  }

  function eliminar(t) {
    if (readOnly) return
    if (!window.confirm(`¿Eliminar el turno "${t.title}" (${t.date} ${t.hour})?`)) return
    adapter.removeTurno(t.id).catch(() => {})
  }

  // turnos ya vienen ordenados por fecha + hora; agrupa por fecha (días vacíos fuera)
  const grupos = [...new Set(turnos.map((t) => t.date))]
    .map((f) => [f, turnos.filter((t) => t.date === f)])
    .filter(([, ts]) => ts.length > 0)

  return (
    <section className="turnos" data-testid="turno-admin">
      <div className="turnos-cabecera">
        <h2 className="turnos-titulo">{titulo}</h2>
        <span className="turnos-cupo">{turnos.length} turnos</span>
      </div>

      <form className="turnos-form" onSubmit={crear}>
        <label className="turnos-f-titulo">Título
          <input name="title" value={form.title} onChange={cambiar} placeholder="Título *" />
        </label>
        <label className="turnos-f-staff">Personal
          <input name="staff" value={form.staff} onChange={cambiar} placeholder="Equipo B *" />
        </label>
        <label className="turnos-f-fecha">Fecha
          <input type="date" name="date" value={form.date} onChange={cambiar} />
        </label>
        <label className="turnos-f-hora">Hora
          <input name="hour" value={form.hour} onChange={cambiar} placeholder="HH:MM *" />
        </label>
        <label className="turnos-f-duracion">Duración (min)
          <input type="number" min="10" name="durationMin" value={form.durationMin} onChange={cambiar} placeholder="30" />
        </label>
        <label className="turnos-f-capacidad">Capacidad
          <input type="number" min="1" name="capacity" value={form.capacity} onChange={cambiar} placeholder="1" />
        </label>
        <label className="turnos-f-prioridad">Prioridad
          <select name="priority" value={form.priority} onChange={cambiar}>
            {PRIORIDADES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="turnos-f-notas">Notas
          <input name="notes" value={form.notes} onChange={cambiar} placeholder="Opcional" />
        </label>
        <button type="submit" className="turnos-btn turnos-btn--primary" disabled={ocupado}>Crear turno</button>
      </form>

      {errores.length > 0 && (
        <ul className="turnos-error-lista" role="alert">
          {errores.map((er) => <li key={er}>{er}</li>)}
        </ul>
      )}
      {aviso && <p className="turnos-aviso turnos-aviso--ok" role="status">{aviso}</p>}

      {turnos.length === 0 ? (
        <p className="turnos-vacio">Sin turnos todavía. Crea el primero arriba.</p>
      ) : (
        <div>
          {grupos.map(([fecha, ts]) => (
            <div key={fecha} className="turnos-franja-grupo">
              <p className="turnos-franja">{fechaBonita(fecha)}</p>
              <ul className="turnos-lista">
                {ts.map((t) => (
                  <li key={t.id} className="turnos-fila">
                    <span className="turnos-fecha">{t.date}</span>
                    <span className="turnos-hora">{t.hour}</span>
                    <div className="turnos-cuerpo">
                      <strong>{t.title}</strong>
                      <span className="turnos-bajito">{t.staff}</span>
                      <span className="turnos-bajito">{t.booked?.length ?? 0}/{t.capacity ?? 1} elegidos</span>
                    </div>
                    <span className={`turnos-prio turnos-prio--${t.priority}`}>
                      {PRIORIDADES.find(([v]) => v === t.priority)?.[1] || t.priority}
                    </span>
                    <select
                      className="turnos-estado"
                      value={t.status}
                      onChange={(e) => cambiarEstado(t, e.target.value)}
                      aria-label={`Estado de ${t.title}`}
                    >
                      {ESTADOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <button type="button" className="turnos-btn turnos-btn--danger" onClick={() => eliminar(t)}>Eliminar</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
