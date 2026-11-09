# Ruta 18 · Resultados del plan de pruebas (fase 5)

Fecha de ejecución: 9 de noviembre de 2026.

Entorno: Supabase local (CLI 2.58.5, PostgreSQL 17, PostgREST y Auth) con `supabase/schema.sql` y `supabase/seed.sql`, el registro de usuarios desactivado y el usuario `admin@ruta18.app`. El sitio se sirvió desde `dist/` con las mismas cabeceras de `vercel.json` (CSP incluida) y se probó con Google Chrome automatizado.

Pendiente: repetir CP-05, CP-12 y CP-17 en el despliegue de Vercel con el proyecto real de Supabase.

## Pruebas automáticas

| Prueba | Resultado |
|---|---|
| `npm test` (lógica pura, `tests/logica.test.js`) | 27 de 27 pasan |
| `supabase/pruebas.sql` (base de datos) | 16 de 16 PASA ([fase2-pruebas-sql-local.txt](fase2-pruebas-sql-local.txt)) |
| Flujo cliente en el navegador | 22 de 22 comprobaciones |
| Panel de administración en el navegador | 24 de 24 comprobaciones |
| Errores de consola o de CSP | Ninguno |

## Plan de pruebas manual (sección 12.2)

| Caso | Requisito | Resultado obtenido | Estado | Evidencia |
|---|---|---|---|---|
| CP-01 | RF-01 | 6 tarjetas con nombre, zona, capacidad y estado. Resumen "6 mesas · 0 con cupo hoy" (lunes, cerrado) | Pasa | [captura](cp01-inicio-escritorio.png) |
| CP-02 | RF-13 | Mesa 4 inactiva en el panel; en el inicio aparecen Mesa 1, 2, 3, 5, 6 y 7, sin la 4 | Pasa | [captura](cp13-admin-mesas.png) |
| CP-03 | RF-03 | Lunes y días posteriores a hoy + 30 deshabilitados. Nota "Hoy: 9 nov · Hasta el 9 dic · Lunes cerrado" | Pasa | [captura](cp04-modal-reserva-escritorio.png) |
| CP-04 | RF-04 | Con una reserva a las 14:00, quedan ocupadas 13:00, 13:30, 14:00, 14:30 y 15:00, con `disabled` y `aria-disabled="true"` | Pasa | |
| CP-05 | RF-05 | Reserva de Laura Gómez, Mesa 3, 14:00 a 15:30, 4 personas, guardada en Supabase | Pasa | |
| CP-06 | RF-06 | Pantalla "¡Reserva confirmada!" con nombre, mesa y zona, fecha, hora de inicio y fin, personas y código de 8 caracteres | Pasa | [captura](cp06-confirmacion.png) |
| CP-07 | RF-05 | 7 personas en Mesa 3: "Esta mesa recibe máximo 6 personas." y botón deshabilitado | Pasa | |
| CP-08 | RF-05 | Nombre vacío al salir del campo: "Escribe tu nombre." | Pasa | |
| CP-09 | Condición de carrera | Dos pestañas, Mesa 5, misma fecha, 19:00. La segunda recibe "Esa hora acaba de ser reservada. Elige otra.", conserva los datos y recarga la grilla | Pasa | |
| CP-10 | RF-07 | Pestaña Sushi: 3 platos con precio en COP ($26.000, $29.000, $32.000) | Pasa | |
| CP-11 | RF-08 | Contraseña errada: "Contraseña incorrecta." | Pasa | [captura](cp11-admin-acceso.png) |
| CP-12 | RF-08 | Contraseña correcta: panel visible en Reservas | Pasa | [captura](cp12-admin-reservas.png) |
| CP-13 | RF-09 | "Mesa 7", Terraza, 4 aparece en la tabla y en el inicio. Nombre repetido y URL sin https rechazados | Pasa | [captura](cp13-admin-mesas.png) |
| CP-14 | RF-11 | Domingo cerrado y guardado: domingos deshabilitados en el calendario. Cierre antes de la apertura rechazado | Pasa | [captura](cp14-admin-horarios.png) |
| CP-15 | RF-12 | Filtro por fecha 11/11/2026 y Mesa 3: solo la reserva que cumple ambos | Pasa | |
| CP-16 | RF-14 | Gaseosa oculta: desaparece de la pestaña Bebidas del inicio | Pasa | [captura](cp16-admin-carta.png) |
| CP-17 | RNF-05 | Sin sesión: insertar mesa, leer reservas y borrar platos responden "permission denied" | Pasa | |
| CP-18 | RNF-02 | 375, 768 y 1440 px sin scroll horizontal; modal a pantalla completa en móvil; tablas del panel como tarjetas | Pasa | [inicio](cp18-inicio-movil-375.png) · [modal](cp18-modal-movil-375.png) · [panel](cp18-admin-movil-375.png) |
| CP-19 | RNF-03 | Lighthouse móvil: rendimiento 94, accesibilidad 100, buenas prácticas 100, SEO 100 | Pasa | |
| CP-20 | RNF-07 | Probado en Chrome. Falta Firefox o Safari | Pendiente | |

## Errores encontrados y corregidos

1. El precio "5.000" se aceptaba como 5 pesos. Ahora el precio solo admite dígitos.
2. La franja y el día seleccionados perdían el color dorado al pasar el mouse.
3. En móvil el botón "Confirmar reserva" no quedaba fijo abajo.
4. En el panel, cambiar rápido de filtro podía pintar una respuesta vieja sobre la nueva. Cada tabla descarta ahora las respuestas que llegan tarde.
