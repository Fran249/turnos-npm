-- turnos v0.1.0 — migración Supabase
-- Generada por `npx turnos init --supabase`.
-- Ejecutar: supabase db push   (o psql "$DATABASE_URL" < 0001_turnos.sql)

create table if not exists public.turnos (
  id           text primary key default encode(gen_random_uuid(), 'hex'),
  title        text not null,
  staff        text not null,
  date         date not null,
  hour         text not null check (hour ~ '^[0-2][0-9]:[0-5][0-9]$'),
  duration_min integer not null default 30 check (duration_min >= 10),
  priority     text not null default 'medium' check (priority in ('low','medium','high')),
  status       text not null default 'pending' check (status in ('pending','confirmed','completed','cancelled')),
  capacity     integer not null default 1 check (capacity >= 1),
  booked       text[] not null default '{}',
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists turnos_date_idx on public.turnos (date, hour);

alter table public.turnos enable row level security;

-- Lectura del horario: pública. AJUSTA a tu esquema de auth si el horario
-- debe ser privado.
create policy turnos_read on public.turnos
  for select using (true);

-- Escritura del horario: solo el rol "admin" de TU auth.
-- AJUSTA la expresión al esquema de roles que uses
-- (p. ej. auth.jwt() ->> 'role' = 'admin').
create policy turnos_admin_write  on public.turnos for insert
  with check (auth.jwt() ->> 'role' = 'admin');
create policy turnos_admin_update on public.turnos for update
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');
create policy turnos_admin_delete on public.turnos for delete
  using (auth.jwt() ->> 'role' = 'admin');

-- Reserva condicional y atómica (nunca supera la capacidad, sin duplicados).
-- El adaptador del paquete `turnos` la llama así:
--   supabase.rpc('book_turno', { turno_id, user })
create or replace function public.book_turno(turno_id text, user text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.turnos%rowtype;
begin
  select * into rec from public.turnos where id = turno_id for update;
  if not found then
    return false;
  end if;
  if rec.status = 'cancelled' then
    return false;
  end if;
  if array_position(rec.booked, user) is not null then
    return false;
  end if;
  if coalesce(array_length(rec.booked, 1), 0) >= rec.capacity then
    return false;
  end if;
  update public.turnos
     set booked = array_append(booked, user),
         updated_at = now()
   where id = turno_id;
  return true;
end;
$$;

grant execute on function public.book_turno(text, text) to anon, authenticated;
