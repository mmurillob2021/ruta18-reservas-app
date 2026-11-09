// Pruebas de la lógica pura (sección 12.1). Ejecutar con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aMinutos, aHora, generarSlots, seCruzan, marcarSlots, diaSemana, sumarDias,
  fechasHabilitadas, diasDelMes, estadoMesaHoy, resumenHorario, validarReserva,
  validarMesa, validarHorario, validarPlato, formatearCOP, formatearFechaLarga,
  formatearFechaCorta, formatearFechaCompleta, formatearFechaNumerica, duracionTexto,
  codigoCorto, textoPaginacion, mensajeError, ahoraBogota, horarioDelDia
} from '../js/logica.js';

const HORARIO = { dia_semana: 'martes', hora_inicio: '12:00', hora_fin: '22:00', duracion_slot: 90, activo: true };
const SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map((dia) => ({
  ...HORARIO, dia_semana: dia, activo: dia !== 'lunes'
}));
const MESA3 = { id: 'm3', nombre: 'Mesa 3', zona: 'salon', capacidad: 6 };

test('aMinutos y aHora son inversas', () => {
  assert.equal(aMinutos('13:30'), 810);
  assert.equal(aMinutos('13:30:00'), 810);
  assert.equal(aHora(810), '13:30');
  assert.equal(aHora(0), '00:00');
});

test('generarSlots: 12:00 a 22:00 con 90 min da 18 franjas, la última 20:30 a 22:00', () => {
  const slots = generarSlots(HORARIO, 30);
  assert.equal(slots.length, 18);
  assert.deepEqual(slots[0], { inicio: '12:00', fin: '13:30' });
  assert.deepEqual(slots.at(-1), { inicio: '20:30', fin: '22:00' });
});

test('generarSlots con 60 y 120 minutos', () => {
  const de60 = generarSlots({ ...HORARIO, duracion_slot: 60 }, 30);
  assert.equal(de60.length, 19);
  assert.deepEqual(de60.at(-1), { inicio: '21:00', fin: '22:00' });
  const de120 = generarSlots({ ...HORARIO, duracion_slot: 120 }, 30);
  assert.equal(de120.length, 17);
  assert.deepEqual(de120.at(-1), { inicio: '20:00', fin: '22:00' });
});

test('generarSlots sin espacio para una reserva devuelve vacío', () => {
  assert.deepEqual(generarSlots({ hora_inicio: '12:00', hora_fin: '13:00', duracion_slot: 90 }, 30), []);
  assert.deepEqual(generarSlots(null), []);
});

test('seCruzan: rangos contiguos no se cruzan', () => {
  assert.equal(seCruzan({ inicio: '13:30', fin: '15:00' }, { inicio: '15:00', fin: '16:30' }), false);
  assert.equal(seCruzan({ inicio: '15:00', fin: '16:30' }, { inicio: '13:30', fin: '15:00' }), false);
});

test('seCruzan: rangos superpuestos o contenidos sí se cruzan', () => {
  assert.equal(seCruzan({ inicio: '14:00', fin: '15:30' }, { inicio: '15:00', fin: '16:30' }), true);
  assert.equal(seCruzan({ inicio: '12:00', fin: '18:00' }, { inicio: '14:00', fin: '15:00' }), true);
});

test('marcarSlots: una reserva de 14:00 a 15:30 ocupa 13:00, 13:30, 14:00, 14:30 y 15:00', () => {
  const ocupados = [{ mesa_id: 'm3', hora_inicio: '14:00', hora_fin: '15:30' }];
  const marcados = marcarSlots(generarSlots(HORARIO), ocupados, '2026-11-17', { fecha: '2026-11-10', hora: '09:00' });
  const ocupadas = marcados.filter((s) => s.estado === 'ocupado').map((s) => s.inicio);
  assert.deepEqual(ocupadas, ['13:00', '13:30', '14:00', '14:30', '15:00']);
  assert.equal(marcados.find((s) => s.inicio === '12:30').estado, 'libre');
  assert.equal(marcados.find((s) => s.inicio === '15:30').estado, 'libre');
});

test('marcarSlots: hoy a las 15:10 marca como pasadas las franjas de 15:00 o antes', () => {
  const marcados = marcarSlots(generarSlots(HORARIO), [], '2026-11-17', { fecha: '2026-11-17', hora: '15:10' });
  const pasadas = marcados.filter((s) => s.estado === 'pasado').map((s) => s.inicio);
  assert.equal(pasadas.at(-1), '15:00');
  assert.equal(pasadas.length, 7);
  assert.equal(marcados.find((s) => s.inicio === '15:30').estado, 'libre');
});

test('diaSemana sin desfase por zona horaria', () => {
  assert.equal(diaSemana('2026-11-17'), 'martes');
  assert.equal(diaSemana('2026-11-16'), 'lunes');
  assert.equal(diaSemana('2026-10-17'), 'sabado');
  assert.equal(diaSemana('2027-01-03'), 'domingo');
});

test('sumarDias cruza meses y años', () => {
  assert.equal(sumarDias('2026-11-30', 1), '2026-12-01');
  assert.equal(sumarDias('2026-12-20', 30), '2027-01-19');
});

test('fechasHabilitadas excluye los lunes cuando el lunes está inactivo', () => {
  const fechas = fechasHabilitadas(SEMANA, '2026-11-09', 30);
  assert.ok(fechas.every((f) => diaSemana(f) !== 'lunes'));
  assert.equal(fechas[0], '2026-11-10');
  assert.equal(fechas.at(-1), '2026-12-09');
  assert.ok(!fechas.includes('2026-12-10'));
});

test('horarioDelDia ignora días inactivos', () => {
  assert.equal(horarioDelDia(SEMANA, '2026-11-16'), null);
  assert.equal(horarioDelDia(SEMANA, '2026-11-17').dia_semana, 'martes');
});

test('diasDelMes empieza en lunes', () => {
  const noviembre = diasDelMes(2026, 11); // 1 de noviembre de 2026 es domingo
  assert.equal(noviembre.filter((c) => c === null).length, 6);
  assert.equal(noviembre[6], '2026-11-01');
  assert.equal(noviembre.at(-1), '2026-11-30');
});

test('estadoMesaHoy: con cupo, sin cupo y cerrado', () => {
  const temprano = { fecha: '2026-11-17', hora: '10:00' };
  assert.equal(estadoMesaHoy(MESA3, HORARIO, [], temprano), 'con-cupo');
  assert.equal(estadoMesaHoy(MESA3, null, [], temprano), 'cerrado');
  assert.equal(estadoMesaHoy(MESA3, HORARIO, [], { fecha: '2026-11-17', hora: '21:00' }), 'sin-cupo');
  const todoElDia = [{ mesa_id: 'm3', hora_inicio: '12:00', hora_fin: '22:00' }];
  assert.equal(estadoMesaHoy(MESA3, HORARIO, todoElDia, temprano), 'sin-cupo');
  const otraMesa = [{ mesa_id: 'm9', hora_inicio: '12:00', hora_fin: '22:00' }];
  assert.equal(estadoMesaHoy(MESA3, HORARIO, otraMesa, temprano), 'con-cupo');
});

test('resumenHorario', () => {
  assert.equal(resumenHorario(SEMANA), 'Martes a domingo · 12:00–22:00');
  assert.equal(resumenHorario([]), 'Horario por confirmar');
});

test('validarReserva: nombre vacío y de una letra', () => {
  assert.equal(validarReserva({ nombre: '  ', personas: 2 }, MESA3).nombre, 'Escribe tu nombre.');
  assert.ok(validarReserva({ nombre: 'A', personas: 2 }, MESA3).nombre);
});

test('validarReserva: personas 0 y por encima de la capacidad', () => {
  assert.ok(validarReserva({ nombre: 'Ana', personas: 0 }, MESA3).personas);
  assert.equal(validarReserva({ nombre: 'Ana', personas: 7 }, MESA3).personas, 'Esta mesa recibe máximo 6 personas.');
  assert.ok(validarReserva({ nombre: 'Ana', personas: 2.5 }, MESA3).personas);
});

test('validarReserva: teléfono con letras', () => {
  assert.ok(validarReserva({ nombre: 'Ana', personas: 2, contacto: 'abc1234' }, MESA3).contacto);
  assert.ok(validarReserva({ nombre: 'Ana', personas: 2, contacto: '123' }, MESA3).contacto);
});

test('validarReserva: todo válido devuelve objeto vacío', () => {
  assert.deepEqual(validarReserva({ nombre: 'Juan Pérez', personas: 4, contacto: '+57 313 491 4296' }, MESA3), {});
  assert.deepEqual(validarReserva({ nombre: 'Juan Pérez', personas: '6', contacto: '' }, MESA3), {});
});

test('validarMesa', () => {
  assert.deepEqual(validarMesa({ nombre: 'Mesa 7', zona: 'terraza', capacidad: 4, foto_url: '' }, ['Mesa 1']), {});
  const errores = validarMesa({ nombre: 'mesa 1', zona: 'patio', capacidad: 21, foto_url: 'http://x' }, ['Mesa 1']);
  assert.deepEqual(Object.keys(errores).sort(), ['capacidad', 'foto_url', 'nombre', 'zona']);
});

test('validarHorario', () => {
  assert.deepEqual(validarHorario(HORARIO), {});
  assert.ok(validarHorario({ ...HORARIO, hora_fin: '11:00' }).hora_fin);
  assert.ok(validarHorario({ ...HORARIO, hora_fin: '13:00' }).hora_fin);
  assert.ok(validarHorario({ ...HORARIO, duracion_slot: 45 }).duracion_slot);
});

test('validarPlato', () => {
  assert.deepEqual(validarPlato({ nombre: 'Gaseosa', categoria: 'bebidas', descripcion: '', precio: '5000' }), {});
  const errores = validarPlato({ nombre: 'G', categoria: 'postres', descripcion: 'x'.repeat(241), precio: '5.000' });
  assert.deepEqual(Object.keys(errores).sort(), ['categoria', 'descripcion', 'nombre', 'precio']);
});

test('formatearCOP', () => {
  assert.equal(formatearCOP(28000), '$28.000');
  assert.equal(formatearCOP(5000), '$5.000');
  assert.equal(formatearCOP(1250000), '$1.250.000');
  assert.equal(formatearCOP(900), '$900');
});

test('formatos de fecha y duración', () => {
  assert.equal(formatearFechaLarga('2026-10-17'), 'Sáb 17 oct 2026');
  assert.equal(formatearFechaCorta('2026-10-17'), 'Sáb 17 oct');
  assert.equal(formatearFechaCompleta('2026-11-14'), 'Sábado 14 de noviembre de 2026');
  assert.equal(formatearFechaNumerica('2026-11-04'), '04/11/2026');
  assert.equal(duracionTexto(90), '1 h 30 min');
  assert.equal(duracionTexto(60), '1 h');
  assert.equal(duracionTexto(30), '30 min');
});

test('codigoCorto y textoPaginacion', () => {
  assert.equal(codigoCorto('3f2a9c1b-0000-4000-8000-000000000000'), '3F2A9C1B');
  assert.equal(textoPaginacion(1, 10, 24), 'Mostrando 1 a 10 de 24 reservas');
  assert.equal(textoPaginacion(3, 10, 24), 'Mostrando 21 a 24 de 24 reservas');
  assert.equal(textoPaginacion(1, 10, 0), 'No hay reservas para mostrar.');
});

test('mensajeError', () => {
  assert.equal(mensajeError('SLOT_OCUPADO'), 'Esa hora acaba de ser reservada. Elige otra.');
  assert.equal(mensajeError('CAPACIDAD_EXCEDIDA', MESA3), 'Esta mesa recibe máximo 6 personas.');
  assert.equal(mensajeError('HORA_INVALIDA'), 'Elige una hora de la lista.');
  assert.equal(mensajeError('OTRA_COSA'), 'No pudimos guardar la reserva. Intenta de nuevo.');
});

test('ahoraBogota usa la zona horaria de Colombia', () => {
  // 2026-11-10 03:30 UTC son las 22:30 del 9 de noviembre en Bogotá
  assert.deepEqual(ahoraBogota(new Date('2026-11-10T03:30:00Z')), { fecha: '2026-11-09', hora: '22:30' });
});
