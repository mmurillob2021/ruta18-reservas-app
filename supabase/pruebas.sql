-- Ruta 18 Sistema de Reservas de Mesas
-- Pruebas de la base de datos para el SQL Editor de Supabase (fase 2, RF-05, RNF-05).
-- Ejecutar después de schema.sql y seed.sql. No deja datos: borra las reservas de prueba al final.
-- Resultado: una tabla con cada caso, lo esperado, lo obtenido y si pasó.

create temp table if not exists resultados_prueba (
  n serial, caso text, esperado text, obtenido text, paso boolean
);
truncate resultados_prueba restart identity;

do $$
declare
  -- Próximo martes (atiende) y próximo lunes (cerrado), al menos una semana adelante
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_martes date := v_hoy + ((2 - extract(dow from v_hoy)::int + 7) % 7 + 7);
  v_lunes date := v_hoy + ((1 - extract(dow from v_hoy)::int + 7) % 7 + 7);
  v_m3 uuid;
  v_m4 uuid;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_obtenido text;
begin
  select id into v_m3 from public.mesas where nombre = 'Mesa 3';
  select id into v_m4 from public.mesas where nombre = 'Mesa 4';
  if v_m3 is null or v_m4 is null then
    raise exception 'Faltan Mesa 3 o Mesa 4. Ejecuta seed.sql primero.';
  end if;

  -- 1. Reserva válida
  begin
    select reserva_id into v_id from public.crear_reserva(v_m3, v_martes, '14:00', 'Prueba Uno', 4, '313 491 4296');
    v_ids := v_ids || v_id; v_obtenido := 'OK';
  exception when others then v_obtenido := sqlerrm; end;
  insert into resultados_prueba (caso, esperado, obtenido) values ('Reserva válida Mesa 3, 14:00', 'OK', v_obtenido);

  -- 2. Doble reserva: misma mesa, fecha y hora
  begin
    select reserva_id into v_id from public.crear_reserva(v_m3, v_martes, '14:00', 'Prueba Dos', 2);
    v_ids := v_ids || v_id; v_obtenido := 'OK';
  exception when others then v_obtenido := sqlerrm; end;
  insert into resultados_prueba (caso, esperado, obtenido) values ('Doble reserva, misma hora', 'SLOT_OCUPADO', v_obtenido);

  -- 3. Franja que se cruza
  begin
    select reserva_id into v_id from public.crear_reserva(v_m3, v_martes, '14:30', 'Prueba Dos', 2);
    v_ids := v_ids || v_id; v_obtenido := 'OK';
  exception when others then v_obtenido := sqlerrm; end;
  insert into resultados_prueba (caso, esperado, obtenido) values ('Franja que se cruza, 14:30', 'SLOT_OCUPADO', v_obtenido);

  -- 4. Franja contigua
  begin
    select reserva_id into v_id from public.crear_reserva(v_m3, v_martes, '15:30', 'Prueba Dos', 2);
    v_ids := v_ids || v_id; v_obtenido := 'OK';
  exception when others then v_obtenido := sqlerrm; end;
  insert into resultados_prueba (caso, esperado, obtenido) values ('Franja contigua, 15:30', 'OK', v_obtenido);

  -- 5. Día sin servicio
  begin
    select reserva_id into v_id from public.crear_reserva(v_m3, v_lunes, '14:00', 'Prueba Dos', 2);
    v_ids := v_ids || v_id; v_obtenido := 'OK';
  exception when others then v_obtenido := sqlerrm; end;
  insert into resultados_prueba (caso, esperado, obtenido) values ('Lunes cerrado', 'DIA_SIN_SERVICIO', v_obtenido);

  -- 6. Capacidad excedida
  begin
    select reserva_id into v_id from public.crear_reserva(v_m3, v_martes, '18:00', 'Prueba Dos', 7);
    v_ids := v_ids || v_id; v_obtenido := 'OK';
  exception when others then v_obtenido := sqlerrm; end;
  insert into resultados_prueba (caso, esperado, obtenido) values ('7 personas en mesa de 6', 'CAPACIDAD_EXCEDIDA', v_obtenido);

  -- 7. Hora que no inicia cada 30 minutos
  begin
    select reserva_id into v_id from public.crear_reserva(v_m4, v_martes, '14:15', 'Prueba Dos', 2);
    v_ids := v_ids || v_id; v_obtenido := 'OK';
  exception when others then v_obtenido := sqlerrm; end;
  insert into resultados_prueba (caso, esperado, obtenido) values ('Hora 14:15', 'HORA_INVALIDA', v_obtenido);

  -- 8. Termina después del cierre
  begin
    select reserva_id into v_id from public.crear_reserva(v_m4, v_martes, '21:00', 'Prueba Dos', 2);
    v_ids := v_ids || v_id; v_obtenido := 'OK';
  exception when others then v_obtenido := sqlerrm; end;
  insert into resultados_prueba (caso, esperado, obtenido) values ('Hora 21:00 con cierre a las 22:00', 'HORA_FUERA_DE_HORARIO', v_obtenido);

  -- 9. Más de 30 días adelante
  begin
    select reserva_id into v_id from public.crear_reserva(v_m4, v_hoy + 40, '14:00', 'Prueba Dos', 2);
    v_ids := v_ids || v_id; v_obtenido := 'OK';
  exception when others then v_obtenido := sqlerrm; end;
  insert into resultados_prueba (caso, esperado, obtenido) values ('Fecha dentro de 40 días', 'FECHA_FUERA_DE_RANGO', v_obtenido);

  -- 10. Contacto con letras
  begin
    select reserva_id into v_id from public.crear_reserva(v_m4, v_martes, '14:00', 'Prueba Dos', 2, 'abc1234');
    v_ids := v_ids || v_id; v_obtenido := 'OK';
  exception when others then v_obtenido := sqlerrm; end;
  insert into resultados_prueba (caso, esperado, obtenido) values ('Teléfono con letras', 'DATOS_INVALIDOS', v_obtenido);

  -- 11. Cancelar libera la franja
  update public.reservas set estado = 'cancelada' where id = v_ids[1];
  begin
    select reserva_id into v_id from public.crear_reserva(v_m3, v_martes, '14:00', 'Prueba Tres', 2);
    v_ids := v_ids || v_id; v_obtenido := 'OK';
  exception when others then v_obtenido := sqlerrm; end;
  insert into resultados_prueba (caso, esperado, obtenido) values ('Reservar 14:00 tras cancelar', 'OK', v_obtenido);

  -- Limpieza: borra las reservas creadas por la prueba
  delete from public.reservas where id = any (v_ids);
end;
$$;

-- RNF-05: permisos del rol anon (el público sin sesión)
insert into resultados_prueba (caso, esperado, obtenido)
values
  ('anon puede insertar mesas', 'false',
   has_table_privilege('anon', 'public.mesas', 'insert')::text),
  ('anon puede leer reservas', 'false',
   has_table_privilege('anon', 'public.reservas', 'select')::text),
  ('anon puede borrar platos', 'false',
   has_table_privilege('anon', 'public.platos', 'delete')::text),
  ('anon puede ejecutar crear_reserva', 'true',
   has_function_privilege('anon', 'public.crear_reserva(uuid, date, time, text, int, text)', 'execute')::text),
  ('RLS activo en las 4 tablas', '4',
   (select count(*)::text from pg_class
     where relnamespace = 'public'::regnamespace and relrowsecurity
       and relname in ('mesas', 'horarios', 'reservas', 'platos')));

update resultados_prueba set paso = (obtenido = esperado);

select n, caso, esperado, obtenido, case when paso then 'PASA' else 'FALLA' end as resultado
from resultados_prueba order by n;
