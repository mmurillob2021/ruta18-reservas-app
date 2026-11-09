// Módulo administrador (admin.html, ruta /admin). Requisitos: RF-08 a RF-14. Flujo de la sección 10.2.
// Sin sesión de Supabase Auth no se muestra ninguna sección del panel, y las reglas RLS
// rechazan cualquier escritura (RNF-05).

import { CONFIG } from './config.js';
import {
  iniciarSesion, cerrarSesion, obtenerSesion, alCambiarSesion,
  listarMesas, guardarMesa, borrarMesa, cambiarEstadoMesa,
  listarHorarios, guardarHorarios,
  listarReservas, cambiarEstadoReserva,
  listarPlatos, guardarPlato, borrarPlato, cambiarDisponibilidadPlato
} from './supabase.js';
import {
  validarMesa, validarHorario, validarPlato, formatearCOP, formatearFechaNumerica,
  textoPaginacion, mensajeError
} from './logica.js';
import { el, limpiar, marcarError, crearModal, mostrarAviso, confirmar } from './ui.js';

const $ = (id) => document.getElementById(id);
const SECCIONES = ['mesas', 'horarios', 'reservas', 'carta'];
const ORDEN_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DURACIONES = [60, 90, 120];
const ESTADOS_RESERVA = { confirmada: 'Confirmada', cancelada: 'Cancelada', completada: 'Completada' };

const estado = {
  seccion: null,
  mesas: [],
  horarios: [],
  reservas: { pagina: 1, fecha: '', mesaId: '' },
  categoria: '',
  // Turno de la última carga de cada tabla: si llega una respuesta vieja, se descarta
  turnos: { mesas: 0, horarios: 0, reservas: 0, platos: 0 }
};

function nuevoTurno(tabla) {
  estado.turnos[tabla] += 1;
  const turno = estado.turnos[tabla];
  return () => turno === estado.turnos[tabla];
}

// Muestra un aviso de error con el mensaje que corresponde al código
function avisarError(error, porDefecto = 'No pudimos completar la acción. Intenta de nuevo.') {
  if (!error?.codigo) console.error(error);
  mostrarAviso(mensajeError(error?.codigo, null, porDefecto), 'error');
}

// Filas de estado para las tablas
function filaMensaje(tbody, columnas, texto, reintentar = null) {
  limpiar(tbody);
  tbody.append(el('tr', { clase: 'tabla-vacia' }, [
    el('td', { attrs: { colspan: columnas } }, [
      el('span', { texto }),
      reintentar ? el('button', { clase: 'boton-texto', texto: 'Reintentar', attrs: { type: 'button' }, alClic: reintentar }) : null
    ])
  ]));
}

function celda(etiqueta, contenido, clase = '') {
  const td = el('td', { clase, attrs: { 'data-etiqueta': etiqueta } });
  td.append(contenido);
  return td;
}

// Interruptor accesible (role="switch")
function interruptor({ activo, etiqueta, textoSi, textoNo, alCambiar }) {
  const texto = el('span', { texto: activo ? textoSi : textoNo, attrs: { 'aria-hidden': 'true' } });
  const boton = el('button', {
    clase: 'interruptor',
    attrs: { type: 'button', role: 'switch', 'aria-checked': String(activo), 'aria-label': etiqueta }
  }, [el('span', { clase: 'interruptor-pista', attrs: { 'aria-hidden': 'true' } }), texto]);
  boton.addEventListener('click', () => alCambiar(boton, boton.getAttribute('aria-checked') !== 'true'));
  boton.fijar = (valor) => {
    boton.setAttribute('aria-checked', String(valor));
    texto.textContent = valor ? textoSi : textoNo;
  };
  return boton;
}

function llenarSelect(select, opciones, conTodas = false) {
  limpiar(select);
  if (conTodas) select.append(el('option', { texto: 'Todas', attrs: { value: '' } }));
  for (const [valor, texto] of Object.entries(opciones)) select.append(el('option', { texto, attrs: { value: valor } }));
}

// ---------------------------------------------------------------------
// RF-08: acceso y sesión
// ---------------------------------------------------------------------

function mostrarAcceso(mensaje = '') {
  $('vista-panel').hidden = true;
  $('vista-acceso').hidden = false;
  const error = $('acceso-error');
  error.textContent = mensaje;
  error.hidden = !mensaje;
  $('acceso-contrasena').value = '';
  $('acceso-contrasena').focus();
  estado.seccion = null;
}

function mostrarPanel() {
  $('vista-acceso').hidden = true;
  $('vista-panel').hidden = false;
  const desdeUrl = location.hash.slice(1);
  irA(SECCIONES.includes(desdeUrl) ? desdeUrl : 'reservas');
}

function configurarAcceso() {
  const campo = $('acceso-contrasena');
  const ver = $('ver-contrasena');
  ver.addEventListener('click', () => {
    const mostrar = campo.type === 'password';
    campo.type = mostrar ? 'text' : 'password';
    ver.setAttribute('aria-pressed', String(mostrar));
    ver.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  $('form-acceso').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const error = $('acceso-error');
    const boton = $('boton-ingresar');
    if (!campo.value) {
      error.textContent = 'Escribe la contraseña.';
      error.hidden = false;
      campo.focus();
      return;
    }
    boton.disabled = true;
    boton.textContent = 'Ingresando...';
    error.hidden = true;
    try {
      await iniciarSesion(campo.value);
      campo.value = '';
      campo.type = 'password';
      mostrarPanel();
    } catch (fallo) {
      // No se revela el correo del administrador
      error.textContent = fallo?.codigo === 'CREDENCIALES'
        ? 'Contraseña incorrecta.'
        : 'No pudimos conectar. Intenta de nuevo.';
      error.hidden = false;
      campo.select();
    } finally {
      boton.disabled = false;
      boton.textContent = 'Ingresar';
    }
  });

  document.querySelectorAll('[data-salir]').forEach((boton) => boton.addEventListener('click', async () => {
    try {
      await cerrarSesion();
    } catch (fallo) {
      console.error(fallo);
    }
    history.replaceState(null, '', location.pathname);
    mostrarAcceso();
  }));
}

// ---------------------------------------------------------------------
// Navegación entre secciones
// ---------------------------------------------------------------------

function irA(seccion, enfocar = false) {
  estado.seccion = seccion;
  for (const nombre of SECCIONES) $(`seccion-${nombre}`).hidden = nombre !== seccion;
  document.querySelectorAll('[data-ir]').forEach((boton) => {
    if (boton.dataset.ir === seccion) boton.setAttribute('aria-current', 'page');
    else boton.removeAttribute('aria-current');
  });
  history.replaceState(null, '', `#${seccion}`);
  if (enfocar) $(`titulo-${seccion}`).focus();
  ({ mesas: cargarMesas, horarios: cargarHorarios, reservas: cargarReservas, carta: cargarPlatos })[seccion]();
}

// ---------------------------------------------------------------------
// RF-09, RF-10, RF-13: mesas
// ---------------------------------------------------------------------

const modalMesa = crearModal($('modal-mesa'));
let mesaEditando = null;
const camposMesa = {
  nombre: $('mesa-nombre'),
  zona: $('mesa-zona'),
  capacidad: $('mesa-capacidad'),
  foto_url: $('mesa-foto')
};

async function cargarMesas() {
  const tbody = $('tabla-mesas');
  filaMensaje(tbody, 5, 'Cargando mesas…');
  const vigente = nuevoTurno('mesas');
  try {
    const mesas = await listarMesas();
    if (!vigente()) return;
    estado.mesas = mesas;
    pintarMesas();
  } catch (error) {
    if (!vigente()) return;
    if (error?.codigo) avisarError(error);
    filaMensaje(tbody, 5, 'No pudimos cargar las mesas.', cargarMesas);
  }
}

function pintarMesas() {
  const tbody = $('tabla-mesas');
  const total = estado.mesas.length;
  $('mesas-descripcion').textContent = `Administra las ${total} ${total === 1 ? 'mesa' : 'mesas'} del restaurante.`;
  if (total === 0) {
    filaMensaje(tbody, 5, 'Aún no hay mesas registradas.');
    return;
  }
  limpiar(tbody);
  for (const mesa of estado.mesas) {
    const acciones = el('div', { clase: 'acciones' }, [
      el('button', { clase: 'boton-texto', texto: 'Editar', attrs: { type: 'button', 'aria-label': `Editar ${mesa.nombre}` }, alClic: () => abrirFormMesa(mesa) }),
      el('button', { clase: 'boton-texto peligro', texto: 'Borrar', attrs: { type: 'button', 'aria-label': `Borrar ${mesa.nombre}` }, alClic: () => borrarMesaConfirmando(mesa) })
    ]);
    tbody.append(el('tr', {}, [
      celda('Mesa', mesa.nombre, 'celda-principal'),
      celda('Zona', CONFIG.ZONAS[mesa.zona] ?? mesa.zona),
      celda('Capacidad', `${mesa.capacidad} ${mesa.capacidad === 1 ? 'persona' : 'personas'}`),
      celda('Estado', interruptor({
        activo: mesa.activa,
        etiqueta: `${mesa.nombre} activa`,
        textoSi: 'Activa',
        textoNo: 'Inactiva',
        alCambiar: (boton, activa) => cambiarActiva(mesa, boton, activa)
      })),
      celda('Acciones', acciones)
    ]));
  }
}

// RF-13: guarda al instante
async function cambiarActiva(mesa, boton, activa) {
  boton.disabled = true;
  try {
    await cambiarEstadoMesa(mesa.id, activa);
    mesa.activa = activa;
    boton.fijar(activa);
    mostrarAviso(`${mesa.nombre} marcada como ${activa ? 'activa' : 'inactiva'}`);
  } catch (error) {
    avisarError(error);
  } finally {
    boton.disabled = false;
  }
}

function abrirFormMesa(mesa = null) {
  mesaEditando = mesa;
  $('mesa-titulo').textContent = mesa ? `Editar ${mesa.nombre}` : 'Nueva mesa';
  camposMesa.nombre.value = mesa?.nombre ?? '';
  camposMesa.zona.value = mesa?.zona ?? Object.keys(CONFIG.ZONAS)[0];
  camposMesa.capacidad.value = mesa?.capacidad ?? 4;
  camposMesa.foto_url.value = mesa?.foto_url ?? '';
  Object.values(camposMesa).forEach((campo) => marcarError(campo, ''));
  $('mesa-error').hidden = true;
  modalMesa.abrir(camposMesa.nombre);
}

async function enviarFormMesa(evento) {
  evento.preventDefault();
  const datos = {
    nombre: camposMesa.nombre.value.trim(),
    zona: camposMesa.zona.value,
    capacidad: camposMesa.capacidad.value,
    foto_url: camposMesa.foto_url.value.trim()
  };
  const otros = estado.mesas.filter((m) => m.id !== mesaEditando?.id).map((m) => m.nombre);
  const errores = validarMesa(datos, otros);
  for (const [clave, campo] of Object.entries(camposMesa)) marcarError(campo, errores[clave]);
  const primero = Object.keys(camposMesa).find((clave) => errores[clave]);
  if (primero) {
    camposMesa[primero].focus();
    return;
  }
  const boton = $('guardar-mesa');
  boton.disabled = true;
  boton.textContent = 'Guardando...';
  try {
    await guardarMesa({ ...datos, capacidad: Number(datos.capacidad) }, mesaEditando?.id);
    modalMesa.cerrar();
    mostrarAviso(mesaEditando ? `${datos.nombre} actualizada` : `${datos.nombre} creada`);
    await cargarMesas();
  } catch (error) {
    if (error?.codigo === 'NOMBRE_DUPLICADO') {
      marcarError(camposMesa.nombre, mensajeError(error.codigo));
      camposMesa.nombre.focus();
    } else {
      const caja = $('mesa-error');
      caja.textContent = mensajeError(error?.codigo, null, 'No pudimos guardar la mesa. Intenta de nuevo.');
      caja.hidden = false;
    }
  } finally {
    boton.disabled = false;
    boton.textContent = 'Guardar';
  }
}

// RF-09: borrar con diálogo propio; si tiene reservas la base de datos lo impide
async function borrarMesaConfirmando(mesa) {
  const si = await confirmar({
    titulo: `¿Borrar ${mesa.nombre}?`,
    texto: 'Esta acción no se puede deshacer.',
    textoConfirmar: 'Borrar',
    peligro: true
  });
  if (!si) return;
  try {
    await borrarMesa(mesa.id);
    mostrarAviso(`${mesa.nombre} borrada`);
    await cargarMesas();
  } catch (error) {
    avisarError(error, 'No pudimos borrar la mesa. Intenta de nuevo.');
  }
}

// ---------------------------------------------------------------------
// RF-11: horarios
// ---------------------------------------------------------------------

async function cargarHorarios() {
  const tbody = $('tabla-horarios');
  filaMensaje(tbody, 5, 'Cargando horarios…');
  const vigente = nuevoTurno('horarios');
  try {
    const guardados = await listarHorarios();
    if (!vigente()) return;
    // Si falta un día se propone el valor inicial: martes a domingo de 12:00 a 22:00, 90 min
    estado.horarios = ORDEN_SEMANA.map((dia) => {
      const fila = guardados.find((h) => h.dia_semana === dia);
      return fila ? { ...fila } : { dia_semana: dia, hora_inicio: '12:00', hora_fin: '22:00', duracion_slot: 90, activo: dia !== 'lunes' };
    });
    pintarHorarios();
  } catch (error) {
    if (!vigente()) return;
    if (error?.codigo) avisarError(error);
    filaMensaje(tbody, 5, 'No pudimos cargar los horarios.', cargarHorarios);
  }
}

function pintarHorarios() {
  const tbody = $('tabla-horarios');
  limpiar(tbody);
  for (const fila of estado.horarios) {
    const dia = CONFIG.DIAS_ETIQUETA[fila.dia_semana];
    const id = `horario-${fila.dia_semana}`;
    const apertura = el('input', { clase: 'entrada', attrs: { type: 'time', id: `${id}-inicio`, value: fila.hora_inicio, 'aria-label': `Apertura del ${dia.toLowerCase()}` } });
    const cierre = el('input', { clase: 'entrada', attrs: { type: 'time', id: `${id}-fin`, value: fila.hora_fin, 'aria-label': `Cierre del ${dia.toLowerCase()}` } });
    const duracion = el('select', { clase: 'entrada', attrs: { id: `${id}-duracion`, 'aria-label': `Duración de la reserva del ${dia.toLowerCase()}` } });
    const opciones = DURACIONES.includes(Number(fila.duracion_slot)) ? DURACIONES : [...DURACIONES, Number(fila.duracion_slot)];
    for (const minutos of opciones) duracion.append(el('option', { texto: `${minutos} min`, attrs: { value: minutos } }));
    duracion.value = String(fila.duracion_slot);

    apertura.addEventListener('input', () => { fila.hora_inicio = apertura.value; });
    cierre.addEventListener('input', () => { fila.hora_fin = cierre.value; });
    duracion.addEventListener('change', () => { fila.duracion_slot = Number(duracion.value); });

    const error = el('tr', { clase: 'fila-error', attrs: { hidden: true } }, [
      el('td', { clase: 'celda-error', attrs: { colspan: 5, id: `${id}-error` } })
    ]);
    fila.controles = { apertura, cierre, duracion, error };

    tbody.append(
      el('tr', {}, [
        celda('Día', dia, 'celda-principal'),
        celda('Atiende', interruptor({
          activo: fila.activo,
          etiqueta: `Atiende el ${dia.toLowerCase()}`,
          textoSi: 'Atiende',
          textoNo: 'Cerrado',
          alCambiar: (boton, activo) => {
            fila.activo = activo;
            boton.fijar(activo);
          }
        })),
        celda('Apertura', apertura),
        celda('Cierre', cierre),
        celda('Duración', duracion)
      ]),
      error
    );
  }
}

async function enviarHorarios(evento) {
  evento.preventDefault();
  let primero = null;
  for (const fila of estado.horarios) {
    const errores = validarHorario(fila);
    const { apertura, cierre, duracion, error } = fila.controles;
    const mensajes = Object.values(errores);
    error.hidden = mensajes.length === 0;
    error.firstChild.textContent = `${CONFIG.DIAS_ETIQUETA[fila.dia_semana]}: ${mensajes.join(' ')}`;
    for (const [control, clave] of [[apertura, 'hora_inicio'], [cierre, 'hora_fin'], [duracion, 'duracion_slot']]) {
      if (errores[clave]) {
        control.setAttribute('aria-invalid', 'true');
        control.setAttribute('aria-describedby', error.firstChild.id);
        primero ??= control;
      } else {
        control.removeAttribute('aria-invalid');
        control.removeAttribute('aria-describedby');
      }
    }
  }
  if (primero) {
    mostrarAviso('Revisa los horarios marcados.', 'error');
    primero.focus();
    return;
  }
  const boton = $('guardar-horarios');
  boton.disabled = true;
  boton.textContent = 'Guardando...';
  try {
    await guardarHorarios(estado.horarios);
    mostrarAviso('Horarios guardados');
    await cargarHorarios();
  } catch (error) {
    avisarError(error, 'No pudimos guardar los horarios. Intenta de nuevo.');
  } finally {
    boton.disabled = false;
    boton.textContent = 'Guardar cambios';
  }
}

// ---------------------------------------------------------------------
// RF-12: reservas
// ---------------------------------------------------------------------

async function llenarFiltroMesas() {
  if (estado.mesas.length === 0) estado.mesas = await listarMesas();
  const select = $('filtro-mesa');
  const actual = estado.reservas.mesaId;
  llenarSelect(select, Object.fromEntries(estado.mesas.map((m) => [m.id, m.nombre])), true);
  select.value = actual;
}

async function cargarReservas() {
  const tbody = $('tabla-reservas');
  const filtros = estado.reservas;
  filaMensaje(tbody, 8, 'Cargando reservas…');
  const vigente = nuevoTurno('reservas');
  try {
    await llenarFiltroMesas();
    const { filas, total } = await listarReservas(filtros);
    if (!vigente()) return;
    const paginas = Math.max(1, Math.ceil(total / CONFIG.RESERVAS_POR_PAGINA));
    if (filtros.pagina > paginas) {
      filtros.pagina = paginas;
      await cargarReservas();
      return;
    }
    pintarReservas(filas, total, paginas);
  } catch (error) {
    if (!vigente()) return;
    if (error?.codigo) avisarError(error);
    filaMensaje(tbody, 8, 'No pudimos cargar las reservas.', cargarReservas);
    $('reservas-conteo').textContent = '';
    limpiar($('paginacion'));
  }
}

function pintarReservas(filas, total, paginas) {
  const tbody = $('tabla-reservas');
  const { pagina } = estado.reservas;
  $('reservas-conteo').textContent = textoPaginacion(pagina, CONFIG.RESERVAS_POR_PAGINA, total);
  if (filas.length === 0) {
    filaMensaje(tbody, 8, 'No hay reservas con esos filtros.');
  } else {
    limpiar(tbody);
    for (const reserva of filas) {
      tbody.append(el('tr', {}, [
        celda('Cliente', reserva.cliente_nombre, 'celda-principal'),
        celda('Contacto', reserva.cliente_contacto || 'Sin contacto'),
        celda('Mesa', reserva.mesas?.nombre ?? '—'),
        celda('Fecha', formatearFechaNumerica(reserva.fecha)),
        celda('Hora', `${reserva.hora_inicio}–${reserva.hora_fin}`),
        celda('Personas', String(reserva.num_personas)),
        celda('Estado', el('span', { clase: `chip chip-${reserva.estado}`, texto: ESTADOS_RESERVA[reserva.estado] ?? reserva.estado })),
        celda('Acción', accionReserva(reserva))
      ]));
    }
  }
  pintarPaginacion(paginas);
}

// Una reserva confirmada se puede marcar como completada o cancelada (libera la franja)
function accionReserva(reserva) {
  if (reserva.estado !== 'confirmada') return el('span', { clase: 'texto-suave', texto: '—' });
  const select = el('select', {
    clase: 'entrada',
    attrs: { 'aria-label': `Cambiar estado de la reserva de ${reserva.cliente_nombre}` }
  }, [
    el('option', { texto: 'Cambiar estado', attrs: { value: '' } }),
    el('option', { texto: 'Marcar completada', attrs: { value: 'completada' } }),
    el('option', { texto: 'Cancelar reserva', attrs: { value: 'cancelada' } })
  ]);
  select.addEventListener('change', async () => {
    const nuevo = select.value;
    if (!nuevo) return;
    if (nuevo === 'cancelada') {
      const si = await confirmar({
        titulo: '¿Cancelar la reserva?',
        texto: `Reserva de ${reserva.cliente_nombre} el ${formatearFechaNumerica(reserva.fecha)} a las ${reserva.hora_inicio}. La franja quedará libre para otros clientes.`,
        textoConfirmar: 'Cancelar reserva',
        peligro: true
      });
      if (!si) {
        select.value = '';
        return;
      }
    }
    select.disabled = true;
    try {
      await cambiarEstadoReserva(reserva.id, nuevo);
      mostrarAviso(`Reserva de ${reserva.cliente_nombre} marcada como ${ESTADOS_RESERVA[nuevo].toLowerCase()}`);
      await cargarReservas();
    } catch (error) {
      avisarError(error);
      select.disabled = false;
      select.value = '';
    }
  });
  return select;
}

function pintarPaginacion(paginas) {
  const contenedor = $('paginacion');
  limpiar(contenedor);
  if (paginas <= 1) return;
  const { pagina } = estado.reservas;
  const ir = (numero) => {
    estado.reservas.pagina = numero;
    cargarReservas();
  };
  contenedor.append(el('button', {
    clase: 'pagina', texto: '‹', attrs: { type: 'button', 'aria-label': 'Página anterior', disabled: pagina === 1 }, alClic: () => ir(pagina - 1)
  }));
  const desde = Math.max(1, Math.min(pagina - 2, paginas - 4));
  const hasta = Math.min(paginas, desde + 4);
  for (let numero = desde; numero <= hasta; numero += 1) {
    contenedor.append(el('button', {
      clase: 'pagina',
      texto: String(numero),
      attrs: { type: 'button', 'aria-label': `Página ${numero}`, 'aria-current': numero === pagina ? 'page' : false },
      alClic: () => ir(numero)
    }));
  }
  contenedor.append(el('button', {
    clase: 'pagina', texto: '›', attrs: { type: 'button', 'aria-label': 'Página siguiente', disabled: pagina === paginas }, alClic: () => ir(pagina + 1)
  }));
}

function configurarFiltros() {
  $('form-filtros').addEventListener('submit', (evento) => {
    evento.preventDefault();
    estado.reservas = { pagina: 1, fecha: $('filtro-fecha').value, mesaId: $('filtro-mesa').value };
    cargarReservas();
  });
  $('limpiar-filtros').addEventListener('click', () => {
    $('filtro-fecha').value = '';
    $('filtro-mesa').value = '';
    estado.reservas = { pagina: 1, fecha: '', mesaId: '' };
    cargarReservas();
  });
}

// ---------------------------------------------------------------------
// RF-14: carta
// ---------------------------------------------------------------------

const modalPlato = crearModal($('modal-plato'));
let platoEditando = null;
const camposPlato = {
  nombre: $('plato-nombre'),
  categoria: $('plato-categoria'),
  descripcion: $('plato-descripcion'),
  precio: $('plato-precio')
};

async function cargarPlatos() {
  const tbody = $('tabla-platos');
  filaMensaje(tbody, 5, 'Cargando platos…');
  const vigente = nuevoTurno('platos');
  try {
    const platos = await listarPlatos(estado.categoria);
    if (!vigente()) return;
    pintarPlatos(platos);
  } catch (error) {
    if (!vigente()) return;
    if (error?.codigo) avisarError(error);
    filaMensaje(tbody, 5, 'No pudimos cargar la carta.', cargarPlatos);
  }
}

function pintarPlatos(platos) {
  const tbody = $('tabla-platos');
  if (platos.length === 0) {
    filaMensaje(tbody, 5, estado.categoria ? 'No hay platos en esta categoría.' : 'Aún no hay platos registrados.');
    return;
  }
  limpiar(tbody);
  for (const plato of platos) {
    const acciones = el('div', { clase: 'acciones' }, [
      el('button', { clase: 'boton-texto', texto: 'Editar', attrs: { type: 'button', 'aria-label': `Editar ${plato.nombre}` }, alClic: () => abrirFormPlato(plato) }),
      el('button', { clase: 'boton-texto peligro', texto: 'Borrar', attrs: { type: 'button', 'aria-label': `Borrar ${plato.nombre}` }, alClic: () => borrarPlatoConfirmando(plato) })
    ]);
    tbody.append(el('tr', {}, [
      celda('Plato', plato.nombre, 'celda-principal'),
      celda('Categoría', CONFIG.CATEGORIAS[plato.categoria] ?? plato.categoria),
      celda('Precio', formatearCOP(plato.precio)),
      celda('Disponible', interruptor({
        activo: plato.disponible,
        etiqueta: `${plato.nombre} disponible`,
        textoSi: 'Visible',
        textoNo: 'Oculto',
        alCambiar: async (boton, disponible) => {
          boton.disabled = true;
          try {
            await cambiarDisponibilidadPlato(plato.id, disponible);
            plato.disponible = disponible;
            boton.fijar(disponible);
            mostrarAviso(`${plato.nombre} ${disponible ? 'visible en la carta' : 'oculto de la carta'}`);
          } catch (error) {
            avisarError(error);
          } finally {
            boton.disabled = false;
          }
        }
      })),
      celda('Acciones', acciones)
    ]));
  }
}

function actualizarContador() {
  $('plato-descripcion-contador').textContent = `${camposPlato.descripcion.value.length}/240`;
}

function abrirFormPlato(plato = null) {
  platoEditando = plato;
  $('plato-titulo').textContent = plato ? `Editar ${plato.nombre}` : 'Nuevo plato';
  camposPlato.nombre.value = plato?.nombre ?? '';
  camposPlato.categoria.value = plato?.categoria ?? (estado.categoria || Object.keys(CONFIG.CATEGORIAS)[0]);
  camposPlato.descripcion.value = plato?.descripcion ?? '';
  camposPlato.precio.value = plato?.precio ?? '';
  $('plato-disponible').checked = plato?.disponible ?? true;
  actualizarContador();
  Object.values(camposPlato).forEach((campo) => marcarError(campo, ''));
  $('plato-error').hidden = true;
  modalPlato.abrir(camposPlato.nombre);
}

async function enviarFormPlato(evento) {
  evento.preventDefault();
  const datos = {
    nombre: camposPlato.nombre.value.trim(),
    categoria: camposPlato.categoria.value,
    descripcion: camposPlato.descripcion.value.trim(),
    precio: camposPlato.precio.value.trim(),
    disponible: $('plato-disponible').checked
  };
  const errores = validarPlato(datos);
  for (const [clave, campo] of Object.entries(camposPlato)) marcarError(campo, errores[clave]);
  const primero = Object.keys(camposPlato).find((clave) => errores[clave]);
  if (primero) {
    camposPlato[primero].focus();
    return;
  }
  const boton = $('guardar-plato');
  boton.disabled = true;
  boton.textContent = 'Guardando...';
  try {
    await guardarPlato({ ...datos, precio: Number(datos.precio) }, platoEditando?.id);
    modalPlato.cerrar();
    mostrarAviso(platoEditando ? `${datos.nombre} actualizado` : `${datos.nombre} agregado a la carta`);
    await cargarPlatos();
  } catch (error) {
    const caja = $('plato-error');
    caja.textContent = mensajeError(error?.codigo, null, 'No pudimos guardar el plato. Intenta de nuevo.');
    caja.hidden = false;
  } finally {
    boton.disabled = false;
    boton.textContent = 'Guardar';
  }
}

async function borrarPlatoConfirmando(plato) {
  const si = await confirmar({
    titulo: `¿Borrar ${plato.nombre}?`,
    texto: 'Si solo quieres quitarlo por un tiempo, usa el interruptor para ocultarlo.',
    textoConfirmar: 'Borrar',
    peligro: true
  });
  if (!si) return;
  try {
    await borrarPlato(plato.id);
    mostrarAviso(`${plato.nombre} borrado`);
    await cargarPlatos();
  } catch (error) {
    avisarError(error, 'No pudimos borrar el plato. Intenta de nuevo.');
  }
}

// ---------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------

function configurar() {
  // RNF-08: zonas y categorías vienen de config.js
  llenarSelect(camposMesa.zona, CONFIG.ZONAS);
  llenarSelect(camposPlato.categoria, CONFIG.CATEGORIAS);
  llenarSelect($('filtro-categoria'), CONFIG.CATEGORIAS, true);

  configurarAcceso();
  configurarFiltros();
  document.querySelectorAll('[data-ir]').forEach((boton) => boton.addEventListener('click', () => irA(boton.dataset.ir, true)));
  $('nueva-mesa').addEventListener('click', () => abrirFormMesa());
  $('form-mesa').addEventListener('submit', enviarFormMesa);
  $('form-horarios').addEventListener('submit', enviarHorarios);
  $('nuevo-plato').addEventListener('click', () => abrirFormPlato());
  $('form-plato').addEventListener('submit', enviarFormPlato);
  camposPlato.descripcion.addEventListener('input', actualizarContador);
  $('filtro-categoria').addEventListener('change', (evento) => {
    estado.categoria = evento.target.value;
    cargarPlatos();
  });
}

async function iniciar() {
  configurar();
  // Si la sesión se cierra o vence en otra pestaña, se vuelve a la pantalla de acceso
  alCambiarSesion((sesion) => {
    if (!sesion && !$('vista-panel').hidden) mostrarAcceso('Tu sesión terminó. Vuelve a ingresar.');
  });
  try {
    const sesion = await obtenerSesion();
    if (sesion) mostrarPanel();
    else mostrarAcceso();
  } catch (error) {
    console.error(error);
    mostrarAcceso();
  }
}

iniciar();
