import { useEffect, useState } from 'react'
import './turnos.css'

/**
 * TurnoPicker — el usuario ve los turnos de un día y elige uno.
 * Generado por `npx @ffstack/turnos init`.
 *
 * Uso:
 *   import { turnos } from './turnos/turnos.config'
 *   import TurnoPicker from './turnos/TurnoPicker'
 *   <TurnoPicker adapter={turnos} user="Elsil" />
 *
 * Props:
 *   - adapter: cliente `turnos` (el que exporta turnos.config.js).
 *   - user: identificador (nombre, email, uid…) que se registra en `booked`.
 *   - date?: fecha inicial 'YYYY-MM-DD' (default: hoy). Si el anfitrión controla
 *     la fecha (tira semanal, calendario), pasale una `key={date}` para que el
 *     componente se remonte al día nuevo y arranque en esa fecha.
 *   - onDateChange?: (date) => void  se llama cuando el usuario cambia de día
 *     con el navegador propio del componente.
 *   - showDateNav?: boolean (default true). Ponlo en `false` cuando la fecha
 *     la controla el anfitrión (tira semanal, calendario) para no duplicar
 *     los controles de día.
 *   - onBooked?: (turn) => void   /   onUnbooked?: (turn) => void
 *   - theme?: 'default' | 'modern' | 'glass' | 'dark' (default 'default').
 *
 * El componente es autónomo: solo consume el contrato del cliente
 * (listTurnos/bookTurno/unbookTurno/subscribe), así que funciona igual
 * con Firebase, Supabase o el adaptador 'memory'.
 */
const ETIQUETA_ESTADO = { pending: 'Pendiente', confirmed: 'Confirmado', completed: 'Completado', cancelled: 'Cancelado' }
const MENSAJE_ERROR = {
  lleno: 'El turno está completo.',
  cancelado: 'Este turno fue cancelado.',
  duplicado: 'Ya elegiste este turno.',
  inexistente: 'El turno ya no existe.',
}

function hoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Llave de día sin padding ('2026-01-02' y '2026-1-2' son el mismo día). */
function dia(d) {
  return String(d || '').split('-').map(Number).join('-')
}

function sumarDias(diaIso, delta) {
  const [y, m, dd] = diaIso.split('-').map(Number)
  const f = new Date(y, m - 1, dd + delta)
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}

const FRANJAS = ['Mañana', 'Tarde', 'Noche']

/** Franja de la hora: Mañana 00–11 h, Tarde 12–17 h, Noche 18–23 h. */
function franjaDe(hour) {
  const h = Number(String(hour || '00:00').slice(0, 2))
  return h < 12 ? 'Mañana' : h < 18 ? 'Tarde' : 'Noche'
}

export default function TurnoPicker({ adapter, user, date, onDateChange, showDateNav = true, onBooked, onUnbooked, theme = 'default' }) {
  const [diaSel, setDiaSel] = useState(date || hoy())
  const [turnos, setTurnos] = useState([])
  const [ocupado, setOcupado] = useState('')
  const [aviso, setAviso] = useState({ kind: '', text: '' })
  const readOnly = adapter.readOnly === true

  /** Change day from inside the component and tell the host, if any. */
  function cambiarDia(next) {
    setDiaSel(next)
    onDateChange?.(next)
  }

  useEffect(() => {
    let vivo = true
    const refrescar = () => {
      adapter.listTurnos({ date: diaSel }).then((ts) => vivo && setTurnos(ts)).catch(() => {})
    }
    refrescar()
    const un = adapter.subscribe((ts) => {
      if (vivo) setTurnos(ts.filter((t) => dia(t.date) === dia(diaSel)))
    })
    return () => { vivo = false; un() }
  }, [adapter, diaSel])

  async function elegir(t) {
    if (readOnly) {
      setAviso({ kind: 'err', text: 'Configura Firebase o Supabase para reservar turnos.' })
      return
    }
    if (!user) {
      setAviso({ kind: 'err', text: 'Falta el identificador del usuario (prop `user`). El componente necesita saber quién reserva.' })
      return
    }
    setOcupado(t.id)
    setAviso({ kind: '', text: '' })
    const res = await adapter.bookTurno(t.id, user)
    if (res.ok) {
      setAviso({ kind: 'ok', text: `¡Listo! Turno elegido: ${t.title}.` })
      onBooked?.(res.turn)
    } else {
      setAviso({ kind: 'err', text: MENSAJE_ERROR[res.error] || 'No se pudo elegir el turno.' })
    }
    setOcupado('')
  }

  function soltar(t) {
    if (readOnly) return
    adapter
      .unbookTurno(t.id, user)
      .then((res) => {
        if (res.ok) onUnbooked?.(res.turn)
      })
      .catch(() => {})
  }

  const ordenados = [...turnos].sort((a, b) => a.hour.localeCompare(b.hour))
  const porFranja = FRANJAS.map((f) => [f, ordenados.filter((t) => franjaDe(t.hour) === f)]).filter(([, ts]) => ts.length > 0)

  return (
    <section className={`turnos turnos--theme-${theme}`} data-testid="turno-picker">
      <div className="turnos-cabecera">
        <h2 className="turnos-titulo">Elegir turno</h2>
        {showDateNav && (
          <div className="turnos-nav">
            <button type="button" className="turnos-btn" onClick={() => cambiarDia(sumarDias(diaSel, -1))} aria-label="Día anterior">‹</button>
            <input type="date" className="turnos-campo" value={diaSel} onChange={(e) => cambiarDia(e.target.value)} aria-label="Fecha" />
            <button type="button" className="turnos-btn" onClick={() => cambiarDia(sumarDias(diaSel, 1))} aria-label="Día siguiente">›</button>
          </div>
        )}
      </div>

      {ordenados.length === 0 ? (
        <p className="turnos-vacio">No hay turnos para este día.</p>
      ) : (
        <div>
          {porFranja.map(([nombre, ts]) => (
            <div key={nombre} className="turnos-franja-grupo">
              <p className="turnos-franja">{nombre}</p>
              <ul className="turnos-lista">
                {ts.map((t) => {
                  const elegido = (t.booked || []).includes(user)
                  const lleno = !elegido && (t.booked?.length ?? 0) >= (t.capacity ?? 1)
                  const cancelado = t.status === 'cancelled'
                  return (
                    <li key={t.id} className={`turnos-talon ${cancelado ? 'turnos-talon--cancelada' : ''}`}>
                      <div className="turnos-talon-hora">
                        <span className="turnos-hora">{t.hour}</span>
                        <span className="turnos-dur">+{t.durationMin} min</span>
                      </div>
                      <div className="turnos-talon-datos">
                        <strong className="turnos-talon-titulo">{t.title}</strong>
                        <span className="turnos-bajito">{t.staff}</span>
                      </div>
                      <span className={`turnos-sello turnos-sello--${t.status}`}>{ETIQUETA_ESTADO[t.status] || t.status}</span>
                      <span className="turnos-cupo">{t.booked?.length ?? 0}/{t.capacity ?? 1} elegidos</span>
                      <div className="turnos-talon-accion">
                        {cancelado ? (
                          <button type="button" className="turnos-btn" disabled>Cancelado</button>
                        ) : elegido ? (
                          <button type="button" className="turnos-btn turnos-btn--soft" disabled={ocupado === t.id} onClick={() => soltar(t)}>Quitar</button>
                        ) : (
                          <button
                            type="button"
                            className="turnos-btn turnos-btn--primary"
                            disabled={readOnly || lleno || ocupado === t.id}
                            onClick={() => elegir(t)}
                          >
                            {readOnly ? 'Sin base de datos' : lleno ? 'Completado' : 'Elegir'}
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {aviso.text && <p className={`turnos-aviso turnos-aviso--${aviso.kind}`} role="status">{aviso.text}</p>}
    </section>
  )
}
