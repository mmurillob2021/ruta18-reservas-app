# Ruta 18 · Sistema de Reservas de Mesas

Parcial No 3 de Programación Web, Uniciencia. Docente: Carlos Carrascal.
Autor: Mauricio Murillo Benítez.

## El problema

Ruta 18 es un restaurante de hamburguesas, sushi y platos a la carta en la Cra. 18 #11-34, Bucaramanga (Santander). Hoy recibe reservas por teléfono, WhatsApp o en persona. Eso causa reservas dobles, esperas largas, clientes perdidos y ningún historial.

## La solución

Una aplicación web donde el cliente reserva una mesa por su cuenta y ve la disponibilidad en tiempo real, y el administrador gestiona mesas, horarios, reservas y carta desde un panel protegido.

## Enlaces

| Recurso | Enlace |
|---|---|
| Aplicación en Vercel | _Pendiente (fase 6)_ |
| Video de demostración | _Pendiente_ |
| Archivo de Figma | [Diseño](https://www.figma.com/design/cuSkj1NPd49957RoBRP3CU/ruta18_Mesas) · [Prototipo navegable](https://www.figma.com/proto/cuSkj1NPd49957RoBRP3CU/ruta18_Mesas?node-id=3-36551&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1) |
| Mockups de baja fidelidad | [docs/mockups/](docs/mockups/) |

## Tecnologías

- HTML5, CSS3 y JavaScript ES6+ con módulos ES, sin frameworks ni bundlers.
- [Supabase](https://supabase.com): PostgreSQL, API REST, Auth y RLS. Cliente `@supabase/supabase-js` por CDN.
- [Vercel](https://vercel.com) para el despliegue desde GitHub.
- Pruebas con `node --test`.

## Cómo ejecutar en local

Requisitos: Node.js 20.6 o superior.

```bash
cp .env.example .env      # llenar SUPABASE_URL y SUPABASE_ANON_KEY
npm run dev               # genera dist/ y lo sirve con serve
npm test                  # pruebas de la lógica pura
```

## Cómo configurar Supabase

1. Crear un proyecto en supabase.com (región São Paulo).
2. En SQL Editor, ejecutar `supabase/schema.sql` y luego `supabase/seed.sql`.
3. Authentication, Providers, Email: desactivar "Allow new users to sign up".
4. Authentication, Users, Add user: el correo de `ADMIN_EMAIL` en `js/config.js`, una contraseña de 12 caracteres o más y "Auto Confirm User".
5. Project Settings, API: copiar Project URL y la clave anon public a `.env` y a las variables de entorno de Vercel.

## Estructura de carpetas

```
ruta18-reservas-app/
|-- index.html              # Página principal (cliente)
|-- admin.html              # Panel de administración
|-- css/styles.css          # Variables, componentes y responsive
|-- js/
|   |-- config.js           # Constantes del negocio
|   |-- env.js              # Generado al construir (no se sube)
|   |-- supabase.js         # Cliente y funciones de datos
|   |-- logica.js           # Funciones puras: franjas, validación, formatos
|   |-- ui.js               # Modal, avisos y diálogo de confirmación
|   |-- cliente.js          # Módulo cliente
|   |-- admin.js            # Módulo administrador
|-- assets/img/             # Logo, hero e imagen de respaldo
|-- supabase/               # schema.sql y seed.sql
|-- scripts/build.mjs       # Copia el sitio a dist/ y genera dist/js/env.js
|-- tests/logica.test.js    # Pruebas automáticas
|-- docs/                   # Documento, mockups y evidencias
```

## Requisitos

| Código | Requisito | Estado |
|---|---|---|
| RF-01 | Visualización de mesas disponibles | Pendiente |
| RF-02 | Selección de mesa | Pendiente |
| RF-03 | Elección de fecha | Pendiente |
| RF-04 | Visualización de horarios disponibles | Pendiente |
| RF-05 | Reserva de mesa | Pendiente |
| RF-06 | Confirmación de reserva | Pendiente |
| RF-07 | Consulta de la carta digital | Pendiente |
| RF-08 | Acceso al panel | Pendiente |
| RF-09 | Registro de mesas | Pendiente |
| RF-10 | Listado de mesas | Pendiente |
| RF-11 | Gestión de horarios | Pendiente |
| RF-12 | Visualización de reservas | Pendiente |
| RF-13 | Cambio de estado de mesa | Pendiente |
| RF-14 | Gestión de la carta | Pendiente |
| RNF-01 a RNF-09 | Usabilidad, responsividad, rendimiento, disponibilidad, seguridad, mantenibilidad, compatibilidad, escalabilidad, trazabilidad | Pendiente |

## Plan de pruebas

- Automáticas: `npm test` sobre `js/logica.js` (mínimo 15 pruebas).
- Manuales: casos CP-01 a CP-20 del documento, con evidencias en `docs/evidencias/`.

## Nota de seguridad

La clave anon de Supabase es pública por diseño y llega al navegador. Lo que protege los datos son las reglas RLS: el público solo lee mesas activas, horarios activos y platos disponibles, y crea reservas mediante la función `crear_reserva`. Las escrituras de administración exigen una sesión de Supabase Auth. Las variables de entorno evitan que la URL y la clave queden en el historial de GitHub.

## Autor y créditos

Mauricio Murillo Benítez, Uniciencia, 2026.
