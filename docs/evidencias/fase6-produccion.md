# Ruta 18 · Verificación en producción (fase 6)

Fecha: 9 de noviembre de 2026.

- Aplicación: https://ruta18-reservas-app.vercel.app (panel en `/admin`)
- Vercel: proyecto conectado al repositorio de GitHub, preset Other, variables `SUPABASE_URL` y `SUPABASE_ANON_KEY` en Production y Preview.
- Supabase: proyecto en la nube con `schema.sql` y `seed.sql` ejecutados.

## Resultados

| Verificación | Resultado |
|---|---|
| `/` y `/admin` responden 200 (URL limpia de `/admin`) | Pasa |
| `/docs/`, `/supabase/schema.sql` y `/.env.local` no se publican (404) | Pasa |
| Cabeceras: Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, Permissions-Policy y HSTS | Pasa |
| `js/env.js` generado en el build con la URL y la clave publishable (ninguna clave en GitHub) | Pasa |
| Datos públicos: 6 mesas activas, 6 días con horario (lunes cerrado), 12 platos | Pasa |
| CP-17 sin sesión: leer reservas, insertar una mesa y borrar platos responden 42501 "permission denied" | Pasa |
| Flujo cliente en Chrome (CP-01, 03, 04, 05, 06, 07, 08, 09, 10 y 18): 22 de 22 comprobaciones, sin errores de consola ni de CSP | Pasa |
| CP-09 condición de carrera en dos pestañas: la segunda recibe "Esa hora acaba de ser reservada. Elige otra." | Pasa |
| CP-19 Lighthouse móvil: rendimiento 97, accesibilidad 100, buenas prácticas 100, SEO 100 (FCP 2.0 s, LCP 2.2 s) | Pasa |
| CP-11 y CP-12 acceso al panel con la contraseña real | Lo verifica el autor |

Reservas creadas por la prueba (sirven como datos de ejemplo): Laura Gómez, Mesa 3, 11/11/2026 14:00, y Andrés Ruiz, Mesa 5, 19:00.

Capturas: [inicio](prod-inicio-escritorio.png) · [confirmación](prod-confirmacion.png)
