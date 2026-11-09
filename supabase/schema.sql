-- Ruta 18 Sistema de Reservas de Mesas
-- Esquema, seguridad y funciones
-- Ejecutar en Supabase, SQL Editor, en un proyecto nuevo. Luego ejecutar seed.sql.

create extension if not exists btree_gist;

-- =====================================================================
-- Tablas
-- =====================================================================

-- Tabla mesas (RF-09, RF-10, RF-13)
create table public.mesas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (char_length(trim(nombre)) between 1 and 40),
  zona text not null check (zona in ('terraza', 'salon')),
  capacidad smallint not null check (capacidad between 1 and 20),
  activa boolean not null default true,
  foto_url text check (foto_url is null or foto_url like 'https://%'),
  creado_en timestamptz not null default now()
);

-- Tabla horarios: un registro por día de la semana (RF-11)
-- dia_semana se guarda sin tildes para evitar problemas de codificación
create table public.horarios (
  id uuid primary key default gen_random_uuid(),
  dia_semana text not null unique check (dia_semana in
    ('lunes','martes','miercoles','jueves','viernes','sabado','domingo')),
  hora_inicio time not null,
  hora_fin time not null,
  duracion_slot smallint not null default 90 check (duracion_slot between 30 and 240),
  activo boolean not null default true,
  check (hora_fin > hora_inicio)
);

-- Tabla reservas (RF-05, RF-12)
create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas(id) on delete restrict,
  cliente_nombre text not null check (char_length(trim(cliente_nombre)) between 2 and 80),
  cliente_contacto text check (cliente_contacto is null or cliente_contacto ~ '^[0-9+ ]{7,20}$'),
  num_personas smallint not null check (num_personas >= 1),
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  estado text not null default 'confirmada'
    check (estado in ('confirmada', 'cancelada', 'completada')),
  creado_en timestamptz not null default now(),
  check (hora_fin > hora_inicio),
  -- Evita la doble reserva: dos reservas vigentes de la misma mesa no se cruzan
  constraint reservas_sin_cruce exclude using gist (
    mesa_id with =,
    tsrange(fecha + hora_inicio, fecha + hora_fin) with &&
  ) where (estado <> 'cancelada')
);

create index reservas_fecha_idx on public.reservas (fecha, mesa_id);

-- Tabla platos (RF-07, RF-14)
create table public.platos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(trim(nombre)) between 2 and 80),
  categoria text not null check (categoria in ('hamburguesas', 'sushi', 'platos', 'bebidas')),
  descripcion text check (descripcion is null or char_length(descripcion) <= 240),
  precio integer not null check (precio >= 0),
  disponible boolean not null default true,
  creado_en timestamptz not null default now()
);

-- =====================================================================
-- Seguridad a nivel de fila (RLS) - RNF-05
-- =====================================================================

alter table public.mesas enable row level security;
alter table public.horarios enable row level security;
alter table public.reservas enable row level security;
alter table public.platos enable row level security;

-- Permisos explícitos por rol. RLS filtra después las filas.
grant usage on schema public to anon, authenticated;
-- Supabase da por defecto todos los permisos a anon en tablas nuevas.
-- Se quitan las escrituras como segunda barrera, además de RLS.
revoke insert, update, delete, truncate on public.mesas, public.horarios, public.platos from anon;
grant select on public.mesas, public.horarios, public.platos to anon;
revoke all on public.reservas from anon;
grant select, insert, update, delete
  on public.mesas, public.horarios, public.reservas, public.platos to authenticated;

-- Público: solo lectura de lo visible
create policy mesas_publico_lee on public.mesas
  for select to anon using (activa);
create policy horarios_publico_lee on public.horarios
  for select to anon using (activo);
create policy platos_publico_lee on public.platos
  for select to anon using (disponible);
-- reservas: sin políticas para anon. El público usa las funciones de abajo.

-- Administrador autenticado: control total.
-- Es seguro porque el registro de usuarios está desactivado en Supabase Auth
-- y el único usuario es el administrador (RF-08).
create policy mesas_admin on public.mesas
  for all to authenticated using (true) with check (true);
create policy horarios_admin on public.horarios
  for all to authenticated using (true) with check (true);
create policy reservas_admin on public.reservas
  for all to authenticated using (true) with check (true);
create policy platos_admin on public.platos
  for all to authenticated using (true) with check (true);

-- =====================================================================
-- Funciones
-- =====================================================================

-- Horas ocupadas de una fecha, sin datos personales (RF-04)
create or replace function public.slots_ocupados(p_fecha date)
returns table (mesa_id uuid, hora_inicio time, hora_fin time)
language sql stable security definer set search_path = public as $$
  select r.mesa_id, r.hora_inicio, r.hora_fin
  from public.reservas r
  join public.mesas m on m.id = r.mesa_id and m.activa
  where r.fecha = p_fecha and r.estado <> 'cancelada'
  order by r.hora_inicio;
$$;

revoke all on function public.slots_ocupados(date) from public;
grant execute on function public.slots_ocupados(date) to anon, authenticated;

-- Crea una reserva con todas las validaciones del lado del servidor (RF-05, RF-13)
-- Errores posibles: MESA_NO_DISPONIBLE, CAPACIDAD_EXCEDIDA, FECHA_FUERA_DE_RANGO,
-- DIA_SIN_SERVICIO, HORA_FUERA_DE_HORARIO, HORA_INVALIDA, HORA_PASADA,
-- SLOT_OCUPADO, DATOS_INVALIDOS
create or replace function public.crear_reserva(
  p_mesa_id uuid,
  p_fecha date,
  p_hora_inicio time,
  p_nombre text,
  p_personas int,
  p_contacto text default null
)
returns table (
  reserva_id uuid, mesa_nombre text, mesa_zona text, fecha date,
  hora_inicio time, hora_fin time, num_personas int, cliente_nombre text
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_mesa public.mesas%rowtype;
  v_horario public.horarios%rowtype;
  v_ahora timestamp := (now() at time zone 'America/Bogota');
  v_dia text;
  v_fin time;
  v_id uuid;
begin
  -- RF-13: una mesa inactiva no acepta reservas
  select * into v_mesa from public.mesas m where m.id = p_mesa_id and m.activa;
  if not found then raise exception 'MESA_NO_DISPONIBLE'; end if;

  if p_personas is null or p_personas < 1 or p_personas > v_mesa.capacidad then
    raise exception 'CAPACIDAD_EXCEDIDA';
  end if;

  -- RF-03: desde hoy hasta hoy + 30 días, en hora de Bogotá
  if p_fecha < v_ahora::date or p_fecha > v_ahora::date + 30 then
    raise exception 'FECHA_FUERA_DE_RANGO';
  end if;

  v_dia := (array['domingo','lunes','martes','miercoles','jueves','viernes','sabado'])
           [extract(dow from p_fecha)::int + 1];
  select * into v_horario from public.horarios h where h.dia_semana = v_dia and h.activo;
  if not found then raise exception 'DIA_SIN_SERVICIO'; end if;

  -- RF-04: la franja debe caber dentro del horario del día
  v_fin := p_hora_inicio + make_interval(mins => v_horario.duracion_slot);
  if p_hora_inicio < v_horario.hora_inicio
     or v_fin > v_horario.hora_fin
     or v_fin <= p_hora_inicio then
    raise exception 'HORA_FUERA_DE_HORARIO';
  end if;

  -- Las franjas inician cada 30 minutos desde la apertura
  if (extract(epoch from (p_hora_inicio - v_horario.hora_inicio))::int % 1800) <> 0 then
    raise exception 'HORA_INVALIDA';
  end if;

  if (p_fecha + p_hora_inicio) <= v_ahora then
    raise exception 'HORA_PASADA';
  end if;

  insert into public.reservas
    (mesa_id, cliente_nombre, cliente_contacto, num_personas, fecha, hora_inicio, hora_fin)
  values
    (p_mesa_id, trim(p_nombre), nullif(trim(coalesce(p_contacto, '')), ''),
     p_personas, p_fecha, p_hora_inicio, v_fin)
  returning id into v_id;

  return query select v_id, v_mesa.nombre, v_mesa.zona, p_fecha,
                      p_hora_inicio, v_fin, p_personas, trim(p_nombre);
exception
  -- La restricción reservas_sin_cruce resuelve la condición de carrera de forma atómica
  when exclusion_violation then raise exception 'SLOT_OCUPADO';
  when check_violation or not_null_violation then raise exception 'DATOS_INVALIDOS';
end;
$$;

revoke all on function public.crear_reserva(uuid, date, time, text, int, text) from public;
grant execute on function public.crear_reserva(uuid, date, time, text, int, text) to anon, authenticated;
