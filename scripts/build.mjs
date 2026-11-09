// Construye el sitio estático en dist/ y genera dist/js/env.js con las variables de entorno.
// Uso: npm run build (Vercel) o npm run dev (local, lee .env).
// RNF-05: la URL y la clave anon nunca quedan escritas en el repositorio.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RAIZ, 'dist');
const ENTRADAS = ['index.html', 'admin.html', 'css', 'js', 'assets'];

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

const faltantes = Object.entries({ SUPABASE_URL, SUPABASE_ANON_KEY })
  .filter(([, valor]) => !valor || !valor.trim())
  .map(([nombre]) => nombre);

if (faltantes.length > 0) {
  console.error(`Error: faltan las variables de entorno ${faltantes.join(' y ')}.`);
  console.error('En local: copia .env.example a .env y llena los valores.');
  console.error('En Vercel: Project Settings, Environment Variables.');
  process.exit(1);
}

if (!SUPABASE_URL.startsWith('https://')) {
  console.error('Error: SUPABASE_URL debe empezar por https://');
  process.exit(1);
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

for (const entrada of ENTRADAS) {
  const origen = join(RAIZ, entrada);
  if (!existsSync(origen)) {
    console.warn(`Aviso: no existe ${entrada}, se omite.`);
    continue;
  }
  cpSync(origen, join(DIST, entrada), {
    recursive: true,
    // No se copian el env.js local ni los marcadores de carpetas vacías
    filter: (ruta) => ruta !== join(RAIZ, 'js', 'env.js') && basename(ruta) !== '.gitkeep'
  });
}

const env = { SUPABASE_URL: SUPABASE_URL.trim(), SUPABASE_ANON_KEY: SUPABASE_ANON_KEY.trim() };
mkdirSync(join(DIST, 'js'), { recursive: true });
writeFileSync(
  join(DIST, 'js', 'env.js'),
  `// Generado por scripts/build.mjs. No editar ni subir a GitHub.\nexport const ENV = ${JSON.stringify(env, null, 2)};\n`
);

console.log('Sitio construido en dist/');
