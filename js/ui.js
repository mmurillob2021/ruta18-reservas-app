// Utilidades de DOM compartidas por el cliente y el panel: creación segura de nodos,
// íconos, modal accesible, avisos y diálogo de confirmación.
// Los datos de usuario se insertan siempre con textContent, nunca con innerHTML (RNF-05).

const SVG_NS = 'http://www.w3.org/2000/svg';

// Trazos de los íconos (24 x 24, línea de 1.5 px)
const ICONOS = {
  cerrar: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  calendario: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8 3v4M16 3v4',
  reloj: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  personas: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 20a6.5 6.5 0 0 0-3-5.5',
  ubicacion: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  editar: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  borrar: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  alerta: 'M12 9v4M12 17h.01M10.3 3.9L2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  anterior: 'M15 5l-7 7 7 7',
  siguiente: 'M9 5l7 7-7 7'
};

// Crea un elemento. Los textos se asignan con textContent y los hijos de tipo
// texto se agregan como nodos de texto, así que nunca se interpreta HTML.
export function el(etiqueta, opciones = {}, hijos = []) {
  const nodo = document.createElement(etiqueta);
  const { clase, texto, attrs, alClic } = opciones;
  if (clase) nodo.className = clase;
  if (texto !== undefined && texto !== null) nodo.textContent = String(texto);
  for (const [nombre, valor] of Object.entries(attrs ?? {})) {
    if (valor === false || valor === null || valor === undefined) continue;
    nodo.setAttribute(nombre, valor === true ? '' : String(valor));
  }
  if (alClic) nodo.addEventListener('click', alClic);
  for (const hijo of [].concat(hijos)) {
    if (hijo !== null && hijo !== undefined && hijo !== false) nodo.append(hijo);
  }
  return nodo;
}

// Ícono SVG decorativo (aria-hidden). Para íconos con significado, poner aria-label en el botón.
export function icono(nombre, clase = 'icono') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', clase);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const trazo = document.createElementNS(SVG_NS, 'path');
  trazo.setAttribute('d', ICONOS[nombre] ?? '');
  svg.append(trazo);
  return svg;
}

export function limpiar(nodo) {
  nodo.replaceChildren();
}

// ---------------------------------------------------------------------
// Errores de campos de formulario
// ---------------------------------------------------------------------

// Muestra u oculta el error de un campo. El párrafo de error debe tener id `${campo.id}-error`.
export function marcarError(campo, mensaje) {
  const salida = document.getElementById(`${campo.id}-error`);
  if (mensaje) {
    campo.setAttribute('aria-invalid', 'true');
    if (salida) {
      salida.textContent = mensaje;
      salida.hidden = false;
    }
  } else {
    campo.removeAttribute('aria-invalid');
    if (salida) {
      salida.textContent = '';
      salida.hidden = true;
    }
  }
}

// ---------------------------------------------------------------------
// Modal accesible: role="dialog", aria-modal, cierre con Escape y foco atrapado.
// Se usa un div en lugar de <dialog> para no depender de su soporte (RNF-07).
// ---------------------------------------------------------------------

const pilaModales = [];
const SELECTOR_ENFOCABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
].join(',');

function enfocables(caja) {
  return [...caja.querySelectorAll(SELECTOR_ENFOCABLE)].filter((nodo) => nodo.getClientRects().length > 0);
}

// Solo el modal de arriba de la pila atiende el teclado
document.addEventListener('keydown', (evento) => {
  const actual = pilaModales.at(-1);
  if (!actual) return;
  if (evento.key === 'Escape') {
    evento.preventDefault();
    actual.cerrar();
  } else if (evento.key === 'Tab') {
    const lista = enfocables(actual.caja);
    if (lista.length === 0) {
      evento.preventDefault();
      actual.caja.focus();
      return;
    }
    const primero = lista[0];
    const ultimo = lista.at(-1);
    if (evento.shiftKey && (document.activeElement === primero || !actual.caja.contains(document.activeElement))) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }
});

// fondo: elemento .modal-fondo que contiene un [role="dialog"]
export function crearModal(fondo, { alCerrar } = {}) {
  const caja = fondo.querySelector('[role="dialog"], [role="alertdialog"]');
  if (!caja.hasAttribute('tabindex')) caja.setAttribute('tabindex', '-1');
  let anterior = null;

  const modal = {
    caja,
    abrir(enfocar = null) {
      if (!fondo.hidden) return;
      anterior = document.activeElement;
      fondo.hidden = false;
      document.documentElement.classList.add('sin-desplazamiento');
      pilaModales.push(modal);
      (enfocar ?? enfocables(caja)[0] ?? caja).focus();
    },
    cerrar() {
      if (fondo.hidden) return;
      fondo.hidden = true;
      const indice = pilaModales.indexOf(modal);
      if (indice >= 0) pilaModales.splice(indice, 1);
      if (pilaModales.length === 0) document.documentElement.classList.remove('sin-desplazamiento');
      if (anterior && document.contains(anterior)) anterior.focus();
      alCerrar?.();
    },
    estaAbierto: () => !fondo.hidden
  };

  // Clic en el fondo oscuro o en un botón [data-cerrar] cierra el modal
  fondo.addEventListener('mousedown', (evento) => {
    if (evento.target === fondo) modal.cerrar();
  });
  fondo.querySelectorAll('[data-cerrar]').forEach((boton) => boton.addEventListener('click', () => modal.cerrar()));
  return modal;
}

// ---------------------------------------------------------------------
// Avisos breves (toast)
// ---------------------------------------------------------------------

let contenedorAvisos = null;

export function mostrarAviso(texto, tipo = 'exito') {
  if (!contenedorAvisos) {
    contenedorAvisos = el('div', { clase: 'avisos', attrs: { 'aria-live': 'polite', role: 'status' } });
    document.body.append(contenedorAvisos);
  }
  const aviso = el('div', { clase: `aviso aviso-${tipo}` }, [
    icono(tipo === 'error' ? 'alerta' : 'check'),
    el('span', { texto })
  ]);
  contenedorAvisos.append(aviso);
  setTimeout(() => aviso.remove(), 4000);
}

// ---------------------------------------------------------------------
// Diálogo de confirmación propio (no window.confirm). Devuelve una promesa con true o false.
// ---------------------------------------------------------------------

export function confirmar({ titulo, texto, textoConfirmar = 'Confirmar', peligro = false }) {
  return new Promise((resolver) => {
    let respuesta = false;
    const idTitulo = `confirmar-titulo-${Date.now()}`;
    const idTexto = `${idTitulo}-texto`;
    const botonCancelar = el('button', { clase: 'boton boton-secundario', texto: 'Cancelar', attrs: { type: 'button' } });
    const botonConfirmar = el('button', {
      clase: `boton ${peligro ? 'boton-peligro' : 'boton-primario'}`,
      texto: textoConfirmar,
      attrs: { type: 'button' }
    });
    const caja = el('div', {
      clase: 'modal modal-pequeno',
      attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': idTitulo, 'aria-describedby': idTexto }
    }, [
      el('div', { clase: 'modal-cuerpo' }, [
        el('h2', { clase: 'dialogo-titulo', texto: titulo, attrs: { id: idTitulo } }),
        el('p', { clase: 'dialogo-texto', texto, attrs: { id: idTexto } }),
        el('div', { clase: 'dialogo-acciones' }, [botonCancelar, botonConfirmar])
      ])
    ]);
    const fondo = el('div', { clase: 'modal-fondo', attrs: { hidden: true } }, [caja]);
    document.body.append(fondo);

    const modal = crearModal(fondo, {
      alCerrar: () => {
        fondo.remove();
        resolver(respuesta);
      }
    });
    botonCancelar.addEventListener('click', () => modal.cerrar());
    botonConfirmar.addEventListener('click', () => {
      respuesta = true;
      modal.cerrar();
    });
    modal.abrir(botonCancelar);
  });
}
