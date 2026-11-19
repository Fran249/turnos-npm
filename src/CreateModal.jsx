import { useEffect, useState } from 'react';
import { PRIORITIES, validateNew, fmtDateExport } from './store.js';
import { PRIORITY_LABELS } from './utils.js';

const TODAY = fmtDateExport(new Date());

/**
 * Sheet for creating/editing a turn. Kept deliberately quiet: the dialog is
 * the only elevated surface in the app, so it reads as a sheet lifted off the
 * paper rather than another card.
 */
export default function CreateModal({ open, defaultOpen, editingId, initial, onCreate, onCancel }) {
  const [title, setTitle] = useState('');
  const [staff, setStaff] = useState('');
  const [hour, setHour] = useState('09:30');
  const [durationMin, setDurationMin] = useState(30);
  const [priority, setPriority] = useState('medium');
  const [date, setDate] = useState(TODAY);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (!open) return;
    if (defaultOpen && editingId) {
      const t = initial;
      if (t) {
        setTitle(t.title); setStaff(t.staff); setHour(t.hour); setDurationMin(t.durationMin ?? 30);
        setPriority(t.priority || 'medium'); setDate(t.date); setNotes(t.notes || '');
      }
    } else if (!editingId) {
      setTitle(''); setStaff(''); setHour('09:30'); setDurationMin(30);
      setPriority('medium'); setDate(TODAY); setNotes('');
    }
    setErrors([]);
  }, [open, defaultOpen, editingId, initial]);

  function submit() {
    const e = validateNew({ title: title.trim(), staff: staff.trim(), hour, durationMin, priority, date, notes: notes.trim() });
    setErrors(e);
    if (e.length > 0) return;
    onCreate({ id: editingId, title, staff, hour, durationMin, priority, date, notes });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/35 p-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="turno-titulo"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="turno-titulo" className="serif text-xl font-semibold">
            {defaultOpen ? 'Editar turno' : 'Nuevo turno'}
          </h2>
          <button onClick={onCancel} aria-label="Cerrar" className="btn btn-ghost h-8 w-8 p-0">×</button>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="Título" value={title} onChange={setTitle} />
          <Field label="Personal del turno" value={staff} onChange={setStaff} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha" value={date} onChange={setDate} />
            <Field label="Hora" value={hour} onChange={setHour} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Duración (min)" value={`${durationMin}`} onChange={(v) => setDurationMin(Number(v))} />
            <div>
              <span className="mb-1 block text-xs font-semibold text-subtle">Prioridad</span>
              <div className="grid grid-cols-3 overflow-hidden rounded-md border border-input">
                {PRIORITIES.map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={priority === k}
                    onClick={() => setPriority(k)}
                    className={`py-2 text-xs font-semibold transition-colors ${priority === k ? 'bg-ink text-card' : 'text-subtle hover:bg-background'}`}
                  >
                    {PRIORITY_LABELS[k]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Field label="Notas" value={notes} onChange={setNotes} placeholder="Notas adicionales" />

          {errors.length > 0 && (
            <ul role="alert" className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              {errors.map((err, i) => (
                <li key={i} className="text-xs font-semibold text-destructive">{err}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
          <button onClick={onCancel} className="btn btn-ghost">Cancelar</button>
          <button onClick={submit} className="btn btn-primary">Guardar</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder = '' }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-subtle">{label}</span>
      <input
        className="field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
