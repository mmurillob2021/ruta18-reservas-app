// Lógica de negocio pura: franjas, cruces, fechas, validaciones y formatos.
// No toca el DOM ni la red, para poder probarla con Node (RNF-06).
// Toda comparación de horas se hace en minutos desde medianoche, no con objetos Date.

import { CONFIG } from './config.js';

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];
// Orden de la semana para mostrar (lunes primero)
const ORDEN_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

// ---------------------------------------------------------------------
// Horas
// ---------------------------------------------------------------------

// 'HH:MM' o 'HH:MM:SS' a minutos desde medianoche
export function aMinutos(hora) {
  const [h, m] = String(hora).split(':').map(Number);
  return h * 60 + m;
}

// Minutos desde medianoche a 'HH:MM'
export function aHora(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// RF-04: franjas que inician cada intervaloMin desde la apertura y duran duracion_slot.
// Una franja es válida si termina a la hora de cierre o antes.
export function generarSlots(horario, intervaloMin = CONFIG.INTERVALO_SLOT_MIN) {
  if (!horario) return [];
  const inicio = aMinutos(horario.hora_inicio);
  const fin = aMinutos(horario.hora_fin);
  const duracion = Number(horario.duracion_slot);
  const slots = [];
  if (!(duracion > 0) || !(intervaloMin > 0)) return slots;
  for (let t = inicio; t + duracion <= fin; t += intervaloMin) {
    slots.push({ inicio: aHora(t), fin: aHora(t + duracion) });
  }
  return slots;
}

// Dos rangos se cruzan si cada uno empieza antes de que termine el otro.
// Rangos contiguos (uno termina cuando el otro empieza) no se cruzan.
export function seCruzan(a, b) {
  return aMinutos(a.inicio) < aMinutos(b.fin) && aMinutos(b.inicio) < aMinutos(a.fin);
}

// Acepta reservas con {hora_inicio, hora_fin} o rangos con {inicio, fin}
function comoRango(r) {
  return { inicio: r.inicio ?? r.hora_inicio, fin: r.fin ?? r.hora_fin };
}

// RF-04: marca cada franja como 'libre', 'ocupado' o 'pasado'.
// ahora = { fecha: 'AAAA-MM-DD', hora: 'HH:MM' } en hora de Bogotá.
export function marcarSlots(slots, ocupados, fecha, ahora) {
  const rangos = (ocupados ?? []).map(comoRango);
  return slots.map((slot) => {
    let estado = 'libre';
    const yaPaso = ahora && (fecha < ahora.fecha ||
      (fecha === ahora.fecha && aMinutos(slot.inicio) <= aMinutos(ahora.hora)));
    if (yaPaso) estado = 'pasado';
    else if (rangos.some((r) => seCruzan(slot, r))) estado = 'ocupado';
    return { ...slot, estado };
  });
}

// ---------------------------------------------------------------------
// Fechas (siempre como texto ISO 'AAAA-MM-DD', sin desfase por zona horaria)
// ---------------------------------------------------------------------

function partesFecha(fechaISO) {
  const [a, m, d] = fechaISO.split('-').map(Number);
  return { a, m, d, utc: new Date(Date.UTC(a, m - 1, d)) };
}

// Fecha y hora actuales en Bogotá: { fecha: 'AAAA-MM-DD', hora: 'HH:MM' }
export function ahoraBogota(fecha = new Date()) {
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.ZONA_HORARIA }).format(fecha);
  const hora = new Intl.DateTimeFormat('en-GB', {
    timeZone: CONFIG.ZONA_HORARIA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(fecha);
  return { fecha: dia, hora };
}

// '2026-11-17' -> 'martes'
export function diaSemana(fechaISO) {
  return CONFIG.DIAS[partesFecha(fechaISO).utc.getUTCDay()];
}

export function sumarDias(fechaISO, dias) {
  const { utc } = partesFecha(fechaISO);
  utc.setUTCDate(utc.getUTCDate() + dias);
  return utc.toISOString().slice(0, 10); // seguro: la fecha se armó en UTC
}

// Busca el horario activo del día de una fecha
export function horarioDelDia(horarios, fechaISO) {
  const dia = diaSemana(fechaISO);
  return (horarios ?? []).find((h) => h.dia_semana === dia && h.activo !== false) ?? null;
}

// RF-03: fechas desde hoy hasta hoy + dias con horario activo
export function fechasHabilitadas(horarios, hoyISO, dias = CONFIG.DIAS_MAXIMOS_RESERVA) {
  const fechas = [];
  for (let i = 0; i <= dias; i += 1) {
    const fecha = sumarDias(hoyISO, i);
    if (horarioDelDia(horarios, fecha)) fechas.push(fecha);
  }
  return fechas;
}

// RF-03: celdas de un mes para el calendario, con lunes como primer día.
// Devuelve null en las celdas vacías antes del día 1.
export function diasDelMes(anio, mes) {
  const primero = new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay(); // 0 = domingo
  const desfase = (primero + 6) % 7;
  const total = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const celdas = Array(desfase).fill(null);
  for (let d = 1; d <= total; d += 1) {
    celdas.push(`${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return celdas;
}

export function nombreMes(anio, mes) {
  const nombre = MESES_LARGOS[mes - 1];
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${anio}`;
}

// RF-01: estado de la tarjeta de una mesa según el día de hoy
export function estadoMesaHoy(mesa, horarioHoy, ocupados, ahora) {
  if (!horarioHoy || horarioHoy.activo === false) return 'cerrado';
  const deLaMesa = (ocupados ?? []).filter((o) => !o.mesa_id || o.mesa_id === mesa.id);
  const slots = marcarSlots(generarSlots(horarioHoy), deLaMesa, ahora.fecha, ahora);
  return slots.some((s) => s.estado === 'libre') ? 'con-cupo' : 'sin-cupo';
}

// Texto del hero: 'Martes a domingo · 12:00–22:00'
export function resumenHorario(horarios) {
  const activos = ORDEN_SEMANA
    .map((dia) => (horarios ?? []).find((h) => h.dia_semana === dia && h.activo !== false))
    .filter(Boolean);
  if (activos.length === 0) return 'Horario por confirmar';
  const mismoHorario = activos.every(
    (h) => h.hora_inicio === activos[0].hora_inicio && h.hora_fin === activos[0].hora_fin
  );
  const horas = `${activos[0].hora_inicio}–${activos[0].hora_fin}`;
  const indices = activos.map((h) => ORDEN_SEMANA.indexOf(h.dia_semana));
  const contiguos = indices.every((v, i) => i === 0 || v === indices[i - 1] + 1);
  const etiqueta = (h) => CONFIG.DIAS_ETIQUETA[h.dia_semana];
  let dias;
  if (activos.length === 7) dias = 'Todos los días';
  else if (activos.length === 1) dias = etiqueta(activos[0]);
  else if (contiguos) dias = `${etiqueta(activos[0])} a ${etiqueta(activos.at(-1)).toLowerCase()}`;
  else dias = activos.map(etiqueta).join(', ');
  return mismoHorario ? `${dias} · ${horas}` : dias;
}

// ---------------------------------------------------------------------
// Validaciones: devuelven un objeto de errores por campo, vacío si todo es válido
// ---------------------------------------------------------------------

const PATRON_CONTACTO = /^[0-9+ ]{7,20}$/;

// RF-05
export function validarReserva(datos, mesa) {
  const errores = {};
  const nombre = String(datos.nombre ?? '').trim();
  if (nombre.length === 0) errores.nombre = 'Escribe tu nombre.';
  else if (nombre.length < 2) errores.nombre = 'El nombre debe tener al menos 2 letras.';
  else if (nombre.length > 80) errores.nombre = 'El nombre puede tener máximo 80 caracteres.';

  const contacto = String(datos.contacto ?? '').trim();
  if (contacto && !PATRON_CONTACTO.test(contacto)) {
    errores.contacto = 'Escribe un teléfono de 7 a 20 caracteres, solo dígitos, espacios y +.';
  }

  const personasTexto = String(datos.personas ?? '').trim();
  const personas = Number(personasTexto);
  const capacidad = Number(mesa?.capacidad ?? 0);
  if (personasTexto === '' || !Number.isInteger(personas) || personas < 1) {
    errores.personas = 'Indica cuántas personas van a ir.';
  } else if (personas > capacidad) {
    errores.personas = `Esta mesa recibe máximo ${capacidad} personas.`;
  }
  return errores;
}

// RF-09. nombresExistentes no debe incluir el nombre de la mesa que se edita.
export function validarMesa(datos, nombresExistentes = []) {
  const errores = {};
  const nombre = String(datos.nombre ?? '').trim();
  if (!nombre) errores.nombre = 'Escribe el nombre de la mesa.';
  else if (nombre.length > 40) errores.nombre = 'El nombre puede tener máximo 40 caracteres.';
  else if (nombresExistentes.some((n) => n.trim().toLowerCase() === nombre.toLowerCase())) {
    errores.nombre = 'Ya existe una mesa con ese nombre.';
  }
  if (!Object.hasOwn(CONFIG.ZONAS, datos.zona)) errores.zona = 'Elige una zona.';
  const capacidad = Number(datos.capacidad);
  if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 20) {
    errores.capacidad = 'La capacidad debe ser un número entero de 1 a 20.';
  }
  const foto = String(datos.foto_url ?? '').trim();
  if (foto && !/^https:\/\/\S+$/.test(foto)) errores.foto_url = 'La URL de la foto debe empezar por https://';
  return errores;
}

// RF-11
export function validarHorario(fila) {
  const errores = {};
  if (!/^\d{2}:\d{2}/.test(fila.hora_inicio ?? '')) errores.hora_inicio = 'Indica la hora de apertura.';
  if (!/^\d{2}:\d{2}/.test(fila.hora_fin ?? '')) errores.hora_fin = 'Indica la hora de cierre.';
  if (![60, 90, 120].includes(Number(fila.duracion_slot))) errores.duracion_slot = 'Elige 60, 90 o 120 minutos.';
  if (Object.keys(errores).length > 0) return errores;
  if (aMinutos(fila.hora_fin) <= aMinutos(fila.hora_inicio)) {
    errores.hora_fin = 'El cierre debe ser después de la apertura.';
  } else if (generarSlots(fila).length === 0) {
    errores.hora_fin = `El horario no alcanza para una reserva de ${duracionTexto(Number(fila.duracion_slot))}.`;
  }
  return errores;
}

// RF-14
export function validarPlato(datos) {
  const errores = {};
  const nombre = String(datos.nombre ?? '').trim();
  if (nombre.length < 2) errores.nombre = 'Escribe el nombre del plato (mínimo 2 letras).';
  else if (nombre.length > 80) errores.nombre = 'El nombre puede tener máximo 80 caracteres.';
  if (!Object.hasOwn(CONFIG.CATEGORIAS, datos.categoria)) errores.categoria = 'Elige una categoría.';
  if (String(datos.descripcion ?? '').length > 240) errores.descripcion = 'La descripción puede tener máximo 240 caracteres.';
  const precioTexto = String(datos.precio ?? '').trim();
  // Solo dígitos: '5.000' se rechaza en lugar de leerse como 5
  if (!/^\d{1,9}$/.test(precioTexto)) {
    errores.precio = 'El precio debe ser un número entero en pesos, sin puntos.';
  }
  return errores;
}

// ---------------------------------------------------------------------
// Formatos
// ---------------------------------------------------------------------

// 28000 -> '$28.000'. Se agrupa a mano para que se vea igual en todos los navegadores.
export function formatearCOP(n) {
  const entero = Math.round(Number(n) || 0);
  const signo = entero < 0 ? '-' : '';
  const miles = String(Math.abs(entero)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${signo}$${miles}`;
}

// '2026-10-17' -> 'Sáb 17 oct 2026'
export function formatearFechaLarga(fechaISO) {
  return `${formatearFechaCorta(fechaISO)} ${partesFecha(fechaISO).a}`;
}

// '2026-10-17' -> 'Sáb 17 oct'
export function formatearFechaCorta(fechaISO) {
  const { m, d, utc } = partesFecha(fechaISO);
  return `${DIAS_CORTOS[utc.getUTCDay()]} ${d} ${MESES_CORTOS[m - 1]}`;
}

// '2026-11-14' -> 'Sábado 14 de noviembre de 2026'
export function formatearFechaCompleta(fechaISO) {
  const { a, m, d, utc } = partesFecha(fechaISO);
  return `${DIAS_LARGOS[utc.getUTCDay()]} ${d} de ${MESES_LARGOS[m - 1]} de ${a}`;
}

// '2026-11-14' -> '14/11/2026'
export function formatearFechaNumerica(fechaISO) {
  const { a, m, d } = partesFecha(fechaISO);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
}

// 90 -> '1 h 30 min'
export function duracionTexto(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// RF-06: código corto de la reserva
export function codigoCorto(id) {
  return String(id ?? '').slice(0, 8).toUpperCase();
}

// RF-12: 'Mostrando 1 a 10 de 24 reservas'
export function textoPaginacion(pagina, porPagina, total) {
  if (total === 0) return 'No hay reservas para mostrar.';
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  return `Mostrando ${desde} a ${hasta} de ${total} ${total === 1 ? 'reserva' : 'reservas'}`;
}

// ---------------------------------------------------------------------
// Mensajes de error (códigos de supabase/schema.sql y de js/supabase.js)
// ---------------------------------------------------------------------

const MENSAJES = {
  SLOT_OCUPADO: 'Esa hora acaba de ser reservada. Elige otra.',
  MESA_NO_DISPONIBLE: 'Esta mesa ya no está disponible. Elige otra.',
  DIA_SIN_SERVICIO: 'Ese día el restaurante no atiende.',
  HORA_FUERA_DE_HORARIO: 'Elige una hora de la lista.',
  HORA_INVALIDA: 'Elige una hora de la lista.',
  HORA_PASADA: 'Esa hora ya pasó. Elige una más tarde.',
  FECHA_FUERA_DE_RANGO: `Puedes reservar hasta ${CONFIG.DIAS_MAXIMOS_RESERVA} días adelante.`,
  DATOS_INVALIDOS: 'Revisa los datos del formulario.',
  NOMBRE_DUPLICADO: 'Ya existe una mesa con ese nombre.',
  MESA_CON_RESERVAS: 'Esta mesa tiene reservas. Márcala como inactiva en lugar de borrarla.',
  CREDENCIALES: 'Contraseña incorrecta.',
  SIN_PERMISO: 'Tu sesión terminó. Vuelve a ingresar.'
};

export const MENSAJE_GENERICO = 'No pudimos guardar la reserva. Intenta de nuevo.';

export function mensajeError(codigo, mesa = null, porDefecto = MENSAJE_GENERICO) {
  if (codigo === 'CAPACIDAD_EXCEDIDA') {
    return mesa?.capacidad
      ? `Esta mesa recibe máximo ${mesa.capacidad} personas.`
      : 'Son más personas de las que recibe la mesa.';
  }
  return MENSAJES[codigo] ?? porDefecto;
}
