// Módulo cliente (index.html): mesas, carta y flujo de reserva.
// Requisitos: RF-01 a RF-07. Flujo de la sección 10.1.

import { CONFIG } from './config.js';
import {
  obtenerMesasActivas, obtenerHorariosActivos, obtenerPlatosDisponibles,
  obtenerSlotsOcupados, crearReserva
} from './supabase.js';
import {
  ahoraBogota, generarSlots, marcarSlots, horarioDelDia, fechasHabilitadas, diasDelMes,
  nombreMes, sumarDias, estadoMesaHoy, resumenHorario, validarReserva, formatearCOP,
  formatearFechaLarga, formatearFechaCorta, formatearFechaCompleta, duracionTexto,
  codigoCorto, mensajeError
} from './logica.js';
import { el, icono, limpiar, marcarError, crearModal } from './ui.js';

const $ = (id) => document.getElementById(id);

const ESTADOS_MESA = {
  'con-cupo': { texto: 'Con cupo hoy', clase: 'chip-libre' },
  'sin-cupo': { texto: 'Sin cupo hoy', clase: 'chip-gris' },
  cerrado: { texto: 'Hoy cerrado', clase: 'chip-gris' }
};

const estado = {
  mesas: [],
  horarios: [],
  platos: [],
  ocupadosHoy: [],
  zona: 'todas',
  categoria: 'hamburguesas',
  reserva: null // se llena al abrir el modal
};

// ---------------------------------------------------------------------
// Carga de datos
// ---------------------------------------------------------------------

async function cargarDatos() {
  pintarCargando();
  try {
    const hoy = ahoraBogota().fecha;
    // Paso 1 del flujo: todo en paralelo
    const [mesas, horarios, platos, ocupadosHoy] = await Promise.all([
      obtenerMesasActivas(), obtenerHorariosActivos(), obtenerPlatosDisponibles(), obtenerSlotsOcupados(hoy)
    ]);
    Object.assign(estado, { mesas, horarios, platos, ocupadosHoy });
    $('hero-horario').textContent = resumenHorario(horarios);
    pintarMesas();
    pintarCarta();
  } catch (error) {
    console.error(error);
    pintarErrorCarga();
  }
}

// Refresca mesas y disponibilidad de hoy sin mostrar esqueletos
async function refrescarDisponibilidad() {
  try {
    const [mesas, horarios, ocupadosHoy] = await Promise.all([
      obtenerMesasActivas(), obtenerHorariosActivos(), obtenerSlotsOcupados(ahoraBogota().fecha)
    ]);
    Object.assign(estado, { mesas, horarios, ocupadosHoy });
    $('hero-horario').textContent = resumenHorario(horarios);
    pintarMesas();
  } catch (error) {
    console.error(error);
  }
}

function pintarCargando() {
  const lista = $('lista-mesas');
  lista.setAttribute('aria-busy', 'true');
  limpiar(lista);
  for (let i = 0; i < 4; i += 1) lista.append(el('div', { clase: 'esqueleto' }));
  $('mesas-resumen').textContent = 'Cargando mesas…';
  const panel = $('carta-panel');
  limpiar(panel);
  for (let i = 0; i < 3; i += 1) panel.append(el('div', { clase: 'esqueleto esqueleto-linea' }));
}

function pintarErrorCarga() {
  const lista = $('lista-mesas');
  lista.setAttribute('aria-busy', 'false');
  limpiar(lista);
  lista.append(el('div', { clase: 'estado-vacio' }, [
    el('p', { texto: 'No pudimos cargar la información. Revisa tu conexión.' }),
    el('button', { clase: 'boton boton-secundario', texto: 'Reintentar', attrs: { type: 'button' }, alClic: cargarDatos })
  ]));
  $('mesas-resumen').textContent = 'Sin conexión';
  const panel = $('carta-panel');
  limpiar(panel);
  panel.append(el('p', { clase: 'texto-suave', texto: 'La carta no está disponible en este momento.' }));
}

// ---------------------------------------------------------------------
// RF-01: tarjetas de mesas
// ---------------------------------------------------------------------

function estadoDeMesa(mesa, ahora) {
  return estadoMesaHoy(mesa, horarioDelDia(estado.horarios, ahora.fecha), estado.ocupadosHoy, ahora);
}

function pintarMesas() {
  const ahora = ahoraBogota();
  const lista = $('lista-mesas');
  lista.setAttribute('aria-busy', 'false');
  limpiar(lista);
  $('mesas-fecha').textContent = formatearFechaLarga(ahora.fecha);

  const visibles = estado.mesas.filter((m) => estado.zona === 'todas' || m.zona === estado.zona);
  const conCupo = visibles.filter((m) => estadoDeMesa(m, ahora) === 'con-cupo').length;
  $('mesas-resumen').textContent =
    `${visibles.length} ${visibles.length === 1 ? 'mesa' : 'mesas'} · ${conCupo} con cupo hoy`;

  if (estado.mesas.length === 0) {
    lista.append(el('div', { clase: 'estado-vacio' }, [el('p', { texto: 'Aún no hay mesas registradas.' })]));
    return;
  }
  if (visibles.length === 0) {
    lista.append(el('div', { clase: 'estado-vacio' }, [el('p', { texto: 'No hay mesas en esta zona.' })]));
    return;
  }
  for (const mesa of visibles) lista.append(tarjetaMesa(mesa, estadoDeMesa(mesa, ahora)));
}

function imagenMesa(mesa) {
  const zona = CONFIG.ZONAS[mesa.zona] ?? mesa.zona;
  const respaldo = el('div', { clase: 'mesa-respaldo', attrs: { 'aria-hidden': 'true' } }, [
    el('span', { clase: 'etiqueta', texto: zona }),
    el('strong', { texto: 'R18' }),
    el('span', { texto: 'ESPACIO PARA COMPARTIR' })
  ]);
  if (!mesa.foto_url) return respaldo;
  // RNF-03: carga diferida. Si la foto falla, se muestra la imagen de respaldo.
  const imagen = el('img', {
    clase: 'tarjeta-mesa-imagen',
    attrs: { src: mesa.foto_url, alt: `Foto de ${mesa.nombre}`, loading: 'lazy', decoding: 'async', width: 800, height: 400 }
  });
  imagen.addEventListener('error', () => imagen.replaceWith(respaldo), { once: true });
  return imagen;
}

function tarjetaMesa(mesa, estadoHoy) {
  const chip = ESTADOS_MESA[estadoHoy];
  const zona = CONFIG.ZONAS[mesa.zona] ?? mesa.zona;
  const boton = el('button', {
    clase: 'boton boton-secundario boton-ancho',
    texto: 'Ver horarios',
    attrs: { type: 'button', 'aria-label': `Ver horarios de ${mesa.nombre}` }
  });
  const tarjeta = el('article', { clase: 'tarjeta-mesa' }, [
    imagenMesa(mesa),
    el('div', { clase: 'tarjeta-mesa-cuerpo' }, [
      el('div', { clase: 'tarjeta-mesa-titulo' }, [
        el('h3', { texto: mesa.nombre }),
        el('span', { clase: 'tarjeta-mesa-zona', texto: zona })
      ]),
      el('p', { clase: 'tarjeta-mesa-capacidad' }, [icono('personas'), `${mesa.capacidad} ${mesa.capacidad === 1 ? 'persona' : 'personas'}`]),
      el('span', { clase: `chip ${chip.clase}`, texto: chip.texto }),
      boton
    ])
  ]);
  // RF-02: clic en la tarjeta o en su botón abre el modal
  tarjeta.addEventListener('click', () => abrirReserva(mesa));
  return tarjeta;
}

function configurarFiltroZona() {
  const botones = document.querySelectorAll('#filtro-zona [data-zona]');
  botones.forEach((boton) => boton.addEventListener('click', () => {
    estado.zona = boton.dataset.zona;
    botones.forEach((b) => b.setAttribute('aria-pressed', String(b === boton)));
    pintarMesas();
  }));
}

// ---------------------------------------------------------------------
// RF-07: carta digital con pestañas
// ---------------------------------------------------------------------

function pintarCarta() {
  const panel = $('carta-panel');
  limpiar(panel);
  const platos = estado.platos.filter((p) => p.categoria === estado.categoria);
  if (platos.length === 0) {
    panel.append(el('p', { clase: 'texto-suave', texto: 'Pronto tendremos platos en esta categoría.' }));
    return;
  }
  panel.append(el('ul', { clase: 'carta-lista' }, platos.map((plato) => el('li', {}, [
    el('h3', { texto: plato.nombre }),
    el('span', { clase: 'carta-precio', texto: formatearCOP(plato.precio) }),
    plato.descripcion ? el('p', { texto: plato.descripcion }) : null
  ]))));
}

function configurarPestanas() {
  const pestanas = [...document.querySelectorAll('#carta-pestanas [role="tab"]')];
  const activar = (pestana, enfocar = false) => {
    estado.categoria = pestana.dataset.categoria;
    pestanas.forEach((p) => {
      const activa = p === pestana;
      p.setAttribute('aria-selected', String(activa));
      p.tabIndex = activa ? 0 : -1;
    });
    $('carta-panel').setAttribute('aria-labelledby', pestana.id);
    if (enfocar) pestana.focus();
    pintarCarta();
  };
  pestanas.forEach((pestana, i) => {
    pestana.addEventListener('click', () => activar(pestana));
    // Flechas izquierda y derecha para moverse entre pestañas
    pestana.addEventListener('keydown', (evento) => {
      const paso = { ArrowRight: 1, ArrowLeft: -1 }[evento.key];
      if (!paso) return;
      evento.preventDefault();
      activar(pestanas[(i + paso + pestanas.length) % pestanas.length], true);
    });
  });
}

// ---------------------------------------------------------------------
// RF-02 a RF-06: modal de reserva
// ---------------------------------------------------------------------

const modal = crearModal($('modal-reserva'), {
  alCerrar: () => {
    if (estado.reserva?.exito) refrescarDisponibilidad();
    estado.reserva = null;
  }
});

const campos = {
  nombre: $('reserva-nombre'),
  contacto: $('reserva-contacto'),
  personas: $('reserva-personas')
};

function abrirReserva(mesa) {
  const hoy = ahoraBogota().fecha;
  const fechas = fechasHabilitadas(estado.horarios, hoy);
  const primera = fechas[0] ?? hoy;
  estado.reserva = {
    mesa,
    hoy,
    fechas: new Set(fechas),
    ultimaFecha: sumarDias(hoy, CONFIG.DIAS_MAXIMOS_RESERVA),
    fecha: null,
    anio: Number(primera.slice(0, 4)),
    mes: Number(primera.slice(5, 7)),
    slots: [],
    franja: null,
    tocados: new Set(),
    enviando: false,
    solicitud: 0,
    exito: false
  };

  const zona = CONFIG.ZONAS[mesa.zona] ?? mesa.zona;
  $('modal-titulo').textContent = `Reservar · ${mesa.nombre} (${zona}, ${mesa.capacidad} ${mesa.capacidad === 1 ? 'persona' : 'personas'})`;
  $('vista-reserva').hidden = false;
  $('vista-confirmacion').hidden = true;
  $('form-reserva').reset();
  Object.values(campos).forEach((campo) => marcarError(campo, ''));
  campos.personas.max = String(mesa.capacidad);
  $('reserva-personas-ayuda').textContent = `De 1 a ${mesa.capacidad} ${mesa.capacidad === 1 ? 'persona' : 'personas'}`;
  ocultarErrorReserva();

  modal.abrir($('modal-titulo'));
  if (fechas.length > 0) {
    seleccionarFecha(fechas[0]);
  } else {
    pintarCalendario();
    const franjas = $('franjas');
    limpiar(franjas);
    franjas.append(el('p', { clase: 'estado-vacio', texto: 'No hay fechas disponibles en los próximos días.' }));
    $('horas-nota').textContent = '';
  }
  actualizarResumen();
  actualizarBoton();
}

// RF-03: calendario mensual propio
function pintarCalendario() {
  const r = estado.reserva;
  $('calendario-mes').textContent = nombreMes(r.anio, r.mes);
  const contenedor = $('calendario-dias');
  limpiar(contenedor);
  for (const fecha of diasDelMes(r.anio, r.mes)) {
    if (!fecha) {
      contenedor.append(el('span', { attrs: { 'aria-hidden': 'true' } }));
      continue;
    }
    const habilitada = r.fechas.has(fecha);
    const dia = el('button', {
      clase: `dia${fecha === r.hoy ? ' dia-hoy' : ''}`,
      texto: String(Number(fecha.slice(8))),
      attrs: {
        type: 'button',
        disabled: !habilitada,
        'aria-pressed': habilitada ? String(fecha === r.fecha) : false,
        'aria-current': fecha === r.hoy ? 'date' : false,
        'aria-label': `${formatearFechaCompleta(fecha)}${habilitada ? '' : ', no disponible'}`
      }
    });
    if (habilitada) dia.addEventListener('click', () => seleccionarFecha(fecha, true));
    contenedor.append(dia);
  }

  // Navegación de meses dentro del rango
  const clave = (a, m) => a * 12 + m;
  const actual = clave(r.anio, r.mes);
  $('mes-anterior').disabled = actual <= clave(Number(r.hoy.slice(0, 4)), Number(r.hoy.slice(5, 7)));
  $('mes-siguiente').disabled = actual >= clave(Number(r.ultimaFecha.slice(0, 4)), Number(r.ultimaFecha.slice(5, 7)));

  const cerrados = CONFIG.DIAS.filter((dia) => !estado.horarios.some((h) => h.dia_semana === dia && h.activo !== false))
    .map((dia) => CONFIG.DIAS_ETIQUETA[dia]);
  const textoCerrados = cerrados.length === 0 ? ''
    : ` · ${cerrados.join(' y ')} ${cerrados.length === 1 ? 'cerrado' : 'cerrados'}`;
  $('calendario-nota').textContent =
    `Hoy: ${formatearFechaCorta(r.hoy).slice(4)} · Hasta el ${formatearFechaCorta(r.ultimaFecha).slice(4)}${textoCerrados}`;
}

function cambiarMes(paso) {
  const r = estado.reserva;
  const indice = r.anio * 12 + (r.mes - 1) + paso;
  r.anio = Math.floor(indice / 12);
  r.mes = (indice % 12) + 1;
  pintarCalendario();
}

function seleccionarFecha(fecha, enfocar = false) {
  const r = estado.reserva;
  r.fecha = fecha;
  r.franja = null;
  r.anio = Number(fecha.slice(0, 4));
  r.mes = Number(fecha.slice(5, 7));
  pintarCalendario();
  if (enfocar) $('calendario-dias').querySelector('[aria-pressed="true"]')?.focus();
  actualizarResumen();
  actualizarBoton();
  cargarFranjas();
}

// RF-04: consulta las franjas ocupadas y pinta la grilla
async function cargarFranjas() {
  const r = estado.reserva;
  const solicitud = ++r.solicitud;
  const horario = horarioDelDia(estado.horarios, r.fecha);
  const franjas = $('franjas');
  limpiar(franjas);
  franjas.append(el('div', { clase: 'esqueleto', attrs: { 'aria-label': 'Cargando horas' } }));
  $('horas-nota').textContent = horario
    ? `${formatearFechaCorta(r.fecha)} · Cada reserva dura ${duracionTexto(horario.duracion_slot)}`
    : '';
  try {
    const ocupados = await obtenerSlotsOcupados(r.fecha);
    if (estado.reserva !== r || solicitud !== r.solicitud) return; // respuesta vieja
    const deLaMesa = ocupados.filter((o) => o.mesa_id === r.mesa.id);
    r.slots = marcarSlots(generarSlots(horario), deLaMesa, r.fecha, ahoraBogota());
    pintarFranjas();
  } catch (error) {
    if (estado.reserva !== r || solicitud !== r.solicitud) return;
    console.error(error);
    limpiar(franjas);
    franjas.append(el('div', { clase: 'estado-vacio' }, [
      el('p', { texto: 'No pudimos consultar las horas.' }),
      el('button', { clase: 'boton boton-secundario', texto: 'Reintentar', attrs: { type: 'button' }, alClic: cargarFranjas })
    ]));
  }
}

function pintarFranjas() {
  const r = estado.reserva;
  const franjas = $('franjas');
  limpiar(franjas);
  if (!r.slots.some((s) => s.estado === 'libre')) {
    franjas.append(el('p', { clase: 'estado-vacio', texto: 'No quedan horas libres este día. Prueba otra fecha.' }));
    return;
  }
  for (const slot of r.slots) {
    const libre = slot.estado === 'libre';
    const seleccionada = r.franja?.inicio === slot.inicio;
    const boton = el('button', {
      clase: 'franja',
      texto: slot.inicio,
      attrs: {
        type: 'button',
        disabled: !libre,
        'aria-disabled': libre ? false : 'true',
        'aria-pressed': libre ? String(seleccionada) : false,
        'aria-label': `${slot.inicio} a ${slot.fin}, ${libre ? 'libre' : 'ocupado'}`
      }
    });
    if (libre) {
      boton.addEventListener('click', () => {
        r.franja = slot;
        pintarFranjas();
        franjas.querySelector('[aria-pressed="true"]')?.focus();
        ocultarErrorReserva();
        actualizarResumen();
        actualizarBoton();
      });
    }
    franjas.append(boton);
  }
}

// RF-05: resumen en vivo
function actualizarResumen() {
  const r = estado.reserva;
  if (!r) return;
  const zona = CONFIG.ZONAS[r.mesa.zona] ?? r.mesa.zona;
  const horario = r.fecha ? horarioDelDia(estado.horarios, r.fecha) : null;
  const personas = Number(campos.personas.value);
  const filas = [
    ['Mesa', `${r.mesa.nombre} · ${zona}`],
    ['Fecha', r.fecha ? formatearFechaCompleta(r.fecha) : 'Elige una fecha'],
    ['Hora', r.franja ? `${r.franja.inicio}–${r.franja.fin}` : 'Elige una hora'],
    ['Personas', Number.isInteger(personas) && personas > 0 ? `${personas} ${personas === 1 ? 'persona' : 'personas'}` : '—'],
    ['Duración estimada', horario ? duracionTexto(horario.duracion_slot) : '—']
  ];
  const lista = $('resumen-datos');
  limpiar(lista);
  for (const [titulo, valor] of filas) {
    lista.append(el('div', {}, [el('dt', { texto: titulo }), el('dd', { texto: valor })]));
  }
}

function leerFormulario() {
  return { nombre: campos.nombre.value, contacto: campos.contacto.value, personas: campos.personas.value };
}

// Muestra los errores solo de los campos que la persona ya tocó
function validarCampos() {
  const r = estado.reserva;
  const errores = validarReserva(leerFormulario(), r.mesa);
  for (const [nombre, campo] of Object.entries(campos)) {
    marcarError(campo, r.tocados.has(nombre) ? errores[nombre] : '');
  }
  return errores;
}

function actualizarBoton() {
  const r = estado.reserva;
  const boton = $('boton-confirmar');
  if (!r) return;
  const errores = validarReserva(leerFormulario(), r.mesa);
  boton.disabled = r.enviando || !r.franja || Object.keys(errores).length > 0;
}

function mostrarErrorReserva(mensaje) {
  const caja = $('reserva-error');
  caja.textContent = mensaje;
  caja.hidden = false;
}

function ocultarErrorReserva() {
  const caja = $('reserva-error');
  caja.textContent = '';
  caja.hidden = true;
}

function configurarFormulario() {
  for (const [nombre, campo] of Object.entries(campos)) {
    campo.addEventListener('input', () => {
      if (!estado.reserva) return;
      // El número de personas se valida desde la primera tecla (flujo alternativo de capacidad)
      if (nombre === 'personas' && campo.value !== '') estado.reserva.tocados.add(nombre);
      validarCampos();
      actualizarResumen();
      actualizarBoton();
    });
    campo.addEventListener('blur', () => {
      if (!estado.reserva || (campo.value === '' && nombre === 'contacto')) return;
      estado.reserva.tocados.add(nombre);
      validarCampos();
    });
  }

  $('form-reserva').addEventListener('submit', (evento) => {
    evento.preventDefault();
    const r = estado.reserva;
    if (!r || r.enviando) return;
    Object.keys(campos).forEach((nombre) => r.tocados.add(nombre));
    const errores = validarCampos();
    const primero = Object.keys(campos).find((nombre) => errores[nombre]);
    if (primero) {
      campos[primero].focus();
      return;
    }
    if (!r.franja) {
      mostrarErrorReserva('Elige una hora de la lista.');
      return;
    }
    confirmarReserva();
  });

  $('mes-anterior').addEventListener('click', () => cambiarMes(-1));
  $('mes-siguiente').addEventListener('click', () => cambiarMes(1));
}

// RF-05: confirmación con doble verificación
async function confirmarReserva() {
  const r = estado.reserva;
  const boton = $('boton-confirmar');
  r.enviando = true;
  boton.disabled = true;
  boton.textContent = 'Confirmando...';
  boton.setAttribute('aria-busy', 'true');
  ocultarErrorReserva();

  try {
    // Paso 10 del flujo: vuelve a consultar y verifica que la franja siga libre
    const ocupados = await obtenerSlotsOcupados(r.fecha);
    const [revisada] = marcarSlots([r.franja], ocupados.filter((o) => o.mesa_id === r.mesa.id), r.fecha, ahoraBogota());
    if (revisada.estado !== 'libre') {
      throw { codigo: revisada.estado === 'pasado' ? 'HORA_PASADA' : 'SLOT_OCUPADO' };
    }
    // La base de datos rechaza cruces de forma atómica (restricción de exclusión)
    const datos = leerFormulario();
    const reserva = await crearReserva({
      mesaId: r.mesa.id,
      fecha: r.fecha,
      horaInicio: r.franja.inicio,
      nombre: datos.nombre.trim(),
      personas: Number(datos.personas),
      contacto: datos.contacto.trim()
    });
    if (estado.reserva !== r) return; // el modal se cerró mientras tanto
    r.exito = true;
    mostrarConfirmacion(reserva);
  } catch (error) {
    if (estado.reserva !== r) return;
    const codigo = error?.codigo ?? 'ERROR_DESCONOCIDO';
    if (!error?.codigo) console.error(error);
    mostrarErrorReserva(mensajeError(codigo, r.mesa));
    // La franja ya no sirve: se recarga la grilla y se conservan los datos del formulario
    if (['SLOT_OCUPADO', 'HORA_PASADA', 'HORA_INVALIDA', 'HORA_FUERA_DE_HORARIO'].includes(codigo)) {
      r.franja = null;
      actualizarResumen();
      cargarFranjas();
    }
    if (['MESA_NO_DISPONIBLE', 'DIA_SIN_SERVICIO'].includes(codigo)) refrescarDisponibilidad();
  } finally {
    if (estado.reserva === r) {
      r.enviando = false;
      boton.textContent = 'Confirmar reserva';
      boton.removeAttribute('aria-busy');
      actualizarBoton();
    }
  }
}

// RF-06: pantalla de éxito dentro del modal
function mostrarConfirmacion(reserva) {
  const zona = CONFIG.ZONAS[reserva.mesa_zona] ?? reserva.mesa_zona;
  const vista = $('vista-confirmacion');
  limpiar(vista);
  const titulo = el('h3', { texto: '¡Reserva confirmada!', attrs: { tabindex: '-1' } });
  const filas = [
    ['Nombre', reserva.cliente_nombre],
    ['Mesa', `${reserva.mesa_nombre} · ${zona}`],
    ['Fecha', formatearFechaCompleta(reserva.fecha)],
    ['Hora', `${reserva.hora_inicio} a ${reserva.hora_fin}`],
    ['Personas', `${reserva.num_personas} ${reserva.num_personas === 1 ? 'persona' : 'personas'}`]
  ];
  const lista = el('dl', { clase: 'lista-datos' }, filas.map(([t, v]) => el('div', {}, [el('dt', { texto: t }), el('dd', { texto: v })])));
  lista.append(el('div', {}, [
    el('dt', { texto: 'Código de reserva' }),
    el('dd', { clase: 'codigo-reserva', texto: codigoCorto(reserva.reserva_id) })
  ]));
  vista.append(
    el('div', { clase: 'confirmacion-icono' }, [icono('check')]),
    titulo,
    el('p', { clase: 'texto-suave', texto: 'Te esperamos en Ruta 18. Guarda tu código por si necesitas cambiar algo.' }),
    lista,
    el('button', {
      clase: 'boton boton-primario boton-ancho',
      texto: 'Volver al inicio',
      attrs: { type: 'button' },
      alClic: () => {
        modal.cerrar();
        window.scrollTo({ top: 0 });
      }
    })
  );
  $('modal-titulo').textContent = 'Reserva confirmada';
  $('vista-reserva').hidden = true;
  vista.hidden = false;
  titulo.focus();
}

// ---------------------------------------------------------------------
// Encabezado, pie e inicio
// ---------------------------------------------------------------------

function configurarMenu() {
  const boton = $('menu-boton');
  const menu = $('menu');
  const cerrar = () => {
    menu.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
    boton.setAttribute('aria-label', 'Abrir menú');
  };
  boton.addEventListener('click', () => {
    const abrir = menu.hidden;
    menu.hidden = !abrir;
    boton.setAttribute('aria-expanded', String(abrir));
    boton.setAttribute('aria-label', abrir ? 'Cerrar menú' : 'Abrir menú');
  });
  menu.querySelectorAll('a').forEach((enlace) => enlace.addEventListener('click', cerrar));
}

function pintarPie() {
  $('hero-eslogan').textContent = CONFIG.ESLOGAN;
  $('pie-direccion').textContent = CONFIG.DIRECCION;
  const telefono = $('pie-telefono');
  telefono.textContent = CONFIG.TELEFONO;
  telefono.href = CONFIG.WHATSAPP_URL;
  telefono.target = '_blank';
  telefono.rel = 'noopener';
  const redes = $('pie-redes');
  const enlaces = [['Instagram', CONFIG.INSTAGRAM_URL], ['Facebook', CONFIG.FACEBOOK_URL]].filter(([, url]) => url);
  for (const [nombre, url] of enlaces) {
    redes.append(el('a', { texto: nombre, attrs: { href: url, target: '_blank', rel: 'noopener' } }));
  }
  redes.hidden = enlaces.length === 0;
  $('pie-anio').textContent = ahoraBogota().fecha.slice(0, 4);
}

configurarMenu();
configurarFiltroZona();
configurarPestanas();
configurarFormulario();
pintarPie();
cargarDatos();
