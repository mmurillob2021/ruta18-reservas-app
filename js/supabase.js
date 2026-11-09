// Capa de datos: crea el cliente de Supabase y expone una función por operación.
// Ningún otro módulo llama a Supabase directamente.
// RNF-03: todas las consultas piden columnas explícitas.
// RNF-05: la URL y la clave anon llegan desde js/env.js, que se genera al construir.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { ENV } from './env.js';
import { CONFIG } from './config.js';

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);

const COLUMNAS_MESA = 'id, nombre, zona, capacidad, activa, foto_url';
const COLUMNAS_HORARIO = 'id, dia_semana, hora_inicio, hora_fin, duracion_slot, activo';
const COLUMNAS_PLATO = 'id, nombre, categoria, descripcion, precio, disponible';
const COLUMNAS_RESERVA =
  'id, mesa_id, cliente_nombre, cliente_contacto, num_personas, fecha, hora_inicio, hora_fin, estado, mesas(nombre, zona)';

// Códigos que lanzan las funciones de supabase/schema.sql
const CODIGOS_SERVIDOR = [
  'SLOT_OCUPADO', 'CAPACIDAD_EXCEDIDA', 'MESA_NO_DISPONIBLE', 'DIA_SIN_SERVICIO',
  'HORA_FUERA_DE_HORARIO', 'HORA_INVALIDA', 'HORA_PASADA', 'FECHA_FUERA_DE_RANGO',
  'DATOS_INVALIDOS'
];

// Error con un código estable que la interfaz traduce a un mensaje (logica.js, mensajeError)
export class ErrorDatos extends Error {
  constructor(codigo, original) {
    super(codigo);
    this.name = 'ErrorDatos';
    this.codigo = codigo;
    this.original = original;
  }
}

// Convierte un error de Supabase o de red en uno de los códigos conocidos
function codigoDeError(error) {
  const mensaje = String(error?.message ?? '');
  const delServidor = CODIGOS_SERVIDOR.find((codigo) => mensaje.includes(codigo));
  if (delServidor) return delServidor;
  if (error?.code === '23505') return 'NOMBRE_DUPLICADO';      // restricción unique
  if (error?.code === '23503') return 'MESA_CON_RESERVAS';     // RF-09: on delete restrict
  if (error?.code === '23514') return 'DATOS_INVALIDOS';       // restricción check
  if (error?.code === '42501') return 'SIN_PERMISO';           // RLS o permisos
  if (error?.name === 'AuthApiError' || /invalid login credentials/i.test(mensaje)) return 'CREDENCIALES';
  return 'ERROR_DESCONOCIDO';
}

// Espera una consulta de supabase-js y lanza ErrorDatos si falló
async function ejecutar(consulta) {
  let respuesta;
  try {
    respuesta = await consulta;
  } catch (error) {
    throw new ErrorDatos('ERROR_DESCONOCIDO', error); // sin red u otra falla inesperada
  }
  if (respuesta.error) throw new ErrorDatos(codigoDeError(respuesta.error), respuesta.error);
  return respuesta;
}

// PostgreSQL devuelve las horas como 'HH:MM:SS'. La lógica trabaja con 'HH:MM'.
const hhmm = (hora) => (typeof hora === 'string' ? hora.slice(0, 5) : hora);

function normalizarHorario(h) {
  return { ...h, hora_inicio: hhmm(h.hora_inicio), hora_fin: hhmm(h.hora_fin) };
}

function normalizarReserva(r) {
  return { ...r, hora_inicio: hhmm(r.hora_inicio), hora_fin: hhmm(r.hora_fin) };
}

// =====================================================================
// Módulo cliente (público, clave anon)
// =====================================================================

// RF-01, RF-13: solo mesas activas
export async function obtenerMesasActivas() {
  const { data } = await ejecutar(
    supabase.from('mesas').select(COLUMNAS_MESA).eq('activa', true).order('nombre')
  );
  return data;
}

// RF-03: solo días con horario activo
export async function obtenerHorariosActivos() {
  const { data } = await ejecutar(
    supabase.from('horarios').select(COLUMNAS_HORARIO).eq('activo', true)
  );
  return data.map(normalizarHorario);
}

// RF-07: solo platos disponibles
export async function obtenerPlatosDisponibles() {
  const { data } = await ejecutar(
    supabase.from('platos').select(COLUMNAS_PLATO).eq('disponible', true).order('nombre')
  );
  return data;
}

// RF-04: franjas ocupadas de una fecha, sin datos personales
export async function obtenerSlotsOcupados(fechaISO) {
  const { data } = await ejecutar(supabase.rpc('slots_ocupados', { p_fecha: fechaISO }));
  return data.map(normalizarReserva);
}

// RF-05: la base de datos valida todo y rechaza cruces de forma atómica
export async function crearReserva({ mesaId, fecha, horaInicio, nombre, personas, contacto }) {
  const { data } = await ejecutar(
    supabase.rpc('crear_reserva', {
      p_mesa_id: mesaId,
      p_fecha: fecha,
      p_hora_inicio: horaInicio,
      p_nombre: nombre,
      p_personas: personas,
      p_contacto: contacto || null
    })
  );
  const fila = Array.isArray(data) ? data[0] : data;
  if (!fila) throw new ErrorDatos('ERROR_DESCONOCIDO');
  return normalizarReserva(fila);
}

// =====================================================================
// Módulo administrador (requiere sesión de Supabase Auth)
// =====================================================================

// RF-08: el correo es fijo; el administrador solo escribe la contraseña
export async function iniciarSesion(password) {
  const { data } = await ejecutar(
    supabase.auth.signInWithPassword({ email: CONFIG.ADMIN_EMAIL, password })
  );
  return data.session;
}

export async function cerrarSesion() {
  await ejecutar(supabase.auth.signOut());
}

export async function obtenerSesion() {
  const { data } = await ejecutar(supabase.auth.getSession());
  return data.session;
}

export function alCambiarSesion(callback) {
  return supabase.auth.onAuthStateChange((_evento, sesion) => callback(sesion));
}

// RF-10: todas las mesas, activas e inactivas, ordenadas por nombre
export async function listarMesas() {
  const { data } = await ejecutar(supabase.from('mesas').select(COLUMNAS_MESA).order('nombre'));
  return data;
}

// RF-09: crea la mesa si no hay id; la actualiza si lo hay
export async function guardarMesa({ nombre, zona, capacidad, foto_url }, id = null) {
  const fila = { nombre: nombre.trim(), zona, capacidad, foto_url: foto_url || null };
  const consulta = id
    ? supabase.from('mesas').update(fila).eq('id', id)
    : supabase.from('mesas').insert({ ...fila, activa: true });
  const { data } = await ejecutar(consulta.select(COLUMNAS_MESA).single());
  return data;
}

// RF-09: si la mesa tiene reservas la base de datos lanza MESA_CON_RESERVAS
export async function borrarMesa(id) {
  await ejecutar(supabase.from('mesas').delete().eq('id', id));
}

// RF-13
export async function cambiarEstadoMesa(id, activa) {
  await ejecutar(supabase.from('mesas').update({ activa }).eq('id', id));
}

// RF-11: los 7 días, activos o no
export async function listarHorarios() {
  const { data } = await ejecutar(supabase.from('horarios').select(COLUMNAS_HORARIO));
  return data.map(normalizarHorario);
}

// RF-11: upsert por dia_semana
export async function guardarHorarios(filas) {
  const datos = filas.map(({ dia_semana, hora_inicio, hora_fin, duracion_slot, activo }) => ({
    dia_semana, hora_inicio, hora_fin, duracion_slot, activo
  }));
  await ejecutar(supabase.from('horarios').upsert(datos, { onConflict: 'dia_semana' }));
}

// RF-12: filtros por fecha y mesa, orden por fecha y hora, paginación
export async function listarReservas({ fecha = '', mesaId = '', pagina = 1, porPagina = CONFIG.RESERVAS_POR_PAGINA } = {}) {
  const desde = (pagina - 1) * porPagina;
  let consulta = supabase
    .from('reservas')
    .select(COLUMNAS_RESERVA, { count: 'exact' })
    .order('fecha')
    .order('hora_inicio')
    .range(desde, desde + porPagina - 1);
  if (fecha) consulta = consulta.eq('fecha', fecha);
  if (mesaId) consulta = consulta.eq('mesa_id', mesaId);
  const { data, count } = await ejecutar(consulta);
  return { filas: data.map(normalizarReserva), total: count ?? 0 };
}

// RF-12: una reserva cancelada libera la franja
export async function cambiarEstadoReserva(id, estado) {
  await ejecutar(supabase.from('reservas').update({ estado }).eq('id', id));
}

// RF-14: todos los platos, con filtro opcional por categoría
export async function listarPlatos(categoria = '') {
  let consulta = supabase.from('platos').select(COLUMNAS_PLATO).order('categoria').order('nombre');
  if (categoria) consulta = consulta.eq('categoria', categoria);
  const { data } = await ejecutar(consulta);
  return data;
}

// RF-14: crea el plato si no hay id; lo actualiza si lo hay
export async function guardarPlato({ nombre, categoria, descripcion, precio, disponible }, id = null) {
  const fila = {
    nombre: nombre.trim(),
    categoria,
    descripcion: descripcion?.trim() || null,
    precio,
    disponible
  };
  const consulta = id
    ? supabase.from('platos').update(fila).eq('id', id)
    : supabase.from('platos').insert(fila);
  const { data } = await ejecutar(consulta.select(COLUMNAS_PLATO).single());
  return data;
}

export async function borrarPlato(id) {
  await ejecutar(supabase.from('platos').delete().eq('id', id));
}

// RF-14: "Ocultar" equivale a disponible = false
export async function cambiarDisponibilidadPlato(id, disponible) {
  await ejecutar(supabase.from('platos').update({ disponible }).eq('id', id));
}
