#!/usr/bin/env node
// Verificación ejecutable de las fronteras arquitectónicas del frontend (RNF-18).
//
// El frontend documenta sus capas en docs/architecture/frontend-architecture.md, pero hasta ahora
// nada impedía que una capa importara a otra que no le corresponde: la regla vivía solo en el
// documento. Este script la convierte en una comprobación automática que corre en la CI. Recorre
// los imports reales de src/app, resuelve cada especificador relativo contra su archivo destino y
// falla si el salto cruza una frontera prohibida.
//
// Modelo de tiers: cada capa solo puede depender de las capas de su propio tier o de tiers
// inferiores, nunca de uno superior.
//
//   tier 4  features/           dominios de negocio (una feature NO puede importar otra hermana)
//   tier 3  layout/             shells visuales
//   tier 2  api/ core/ data/    código transversal: cliente API, singletons de core y acceso a datos
//   tier 1  shared/             reutilizable puro, sin negocio: no depende de ninguna otra capa
//
// Además de la comparación por tier, una feature solo puede importar sus propios archivos, nunca
// los de otra feature hermana. Los archivos de composición directamente bajo src/app/ (app.routes,
// app.config, app.component) están exentos: son el punto de unión donde se cablean todas las capas.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(projectRoot, 'src', 'app');

// El cliente OpenAPI no se revisa: lo produce `npm run api:generate` y es código ajeno.
const GENERATED_DIRECTORY = 'api/generated';

const TIERS = {
  shared: 1,
  api: 2,
  core: 2,
  data: 2,
  layout: 3,
  features: 4
};

// Deuda arquitectónica congelada (RNF-18). Cada entrada autoriza un cruce de capas que YA existe y
// que no se corrige en este alcance; cualquier cruce NUEVO falla la verificación. Si una excepción
// deja de ser necesaria (el import desaparece), el script también falla para obligar a borrarla:
// la lista solo puede encogerse.
const KNOWN_EXCEPTIONS = [
  {
    from: 'src/app/shared/ui/states.component.ts',
    to: 'src/app/core/',
    reason: 'El componente de estados de carga/error consume el ConnectivityService transversal.'
  },
  {
    from: 'src/app/shared/ui/photo-picker.component.ts',
    to: 'src/app/data/',
    reason: 'El selector de fotos reutiliza las constantes y el validador de imágenes de data/media.service.'
  },
  {
    from: 'src/app/features/requests/request-detail.page.ts',
    to: 'src/app/features/work/',
    reason: 'La vista de solicitud embebe los paneles operativos del dominio de trabajo (progreso, pagos, visitas y valoración).'
  },
  {
    from: 'src/app/features/dashboard/dashboard.page.ts',
    to: 'src/app/features/ideas/',
    reason: 'El panel reutiliza el feed de ideas como bloque de contenido.'
  }
];

// `import ... from '...'`, `export ... from '...'`, `import('...')` y el import de efecto
// secundario `import '...'`.
const IMPORT_PATTERN = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function collectTypeScriptFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    const relative = toPosix(path.relative(appRoot, fullPath));
    if (entry.isDirectory()) {
      if (relative.startsWith(GENERATED_DIRECTORY)) continue;
      files.push(...collectTypeScriptFiles(fullPath));
    } else if (entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

// Describe a qué capa (y feature, si aplica) pertenece un archivo, o `null` si queda fuera de las
// capas verificadas (por ejemplo, el punto de composición bajo src/app/).
function describeLayer(filePath) {
  const relative = toPosix(path.relative(appRoot, filePath));
  if (relative.startsWith('..')) return null;
  const segments = relative.split('/');
  if (segments.length < 2) return null;
  const layer = segments[0];
  if (!(layer in TIERS)) return null;
  return { layer, feature: layer === 'features' ? segments[1] : null };
}

function describeViolation(source, target) {
  if (source.layer === 'features' && target.layer === 'features') {
    return `la feature "${source.feature}" importa la feature hermana "${target.feature}"`;
  }
  return `la capa "${source.layer}" (tier ${TIERS[source.layer]}) importa la capa "${target.layer}" (tier ${TIERS[target.layer]})`;
}

function isAllowed(source, target) {
  if (source.layer === 'features' && target.layer === 'features') {
    return source.feature === target.feature;
  }
  return TIERS[target.layer] <= TIERS[source.layer];
}

function findExceptions(fromRelative, toRelative) {
  return KNOWN_EXCEPTIONS.filter(
    (exception) => exception.from === fromRelative && toRelative.startsWith(exception.to)
  );
}

function collectViolations() {
  const violations = [];
  const seen = new Set();
  const usedExceptions = new Set();

  for (const file of collectTypeScriptFiles(appRoot)) {
    const source = describeLayer(file);
    if (!source) continue;
    const fromRelative = toPosix(path.relative(projectRoot, file));
    const content = readFileSync(file, 'utf8');

    for (const match of content.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1];
      if (!specifier.startsWith('.')) continue; // paquetes externos o alias: fuera de las capas

      const resolved = path.resolve(path.dirname(file), specifier);
      const target = describeLayer(resolved);
      if (!target) continue; // resuelve fuera de src/app o a una capa no verificada

      if (isAllowed(source, target)) continue;

      const toRelative = toPosix(path.relative(projectRoot, resolved));
      const key = `${fromRelative} -> ${toRelative}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const exceptions = findExceptions(fromRelative, toRelative);
      if (exceptions.length > 0) {
        exceptions.forEach((exception) => usedExceptions.add(exception));
        continue;
      }
      violations.push({ fromRelative, toRelative, detail: describeViolation(source, target) });
    }
  }

  const staleExceptions = KNOWN_EXCEPTIONS.filter((exception) => !usedExceptions.has(exception));
  return { violations, staleExceptions };
}

function report({ violations, staleExceptions }) {
  if (violations.length === 0 && staleExceptions.length === 0) {
    console.log('Fronteras arquitectónicas del frontend verificadas: sin cruces de capa indebidos.');
    return 0;
  }

  if (violations.length > 0) {
    console.error('Cruces de capa prohibidos (RNF-18):\n');
    for (const violation of violations) {
      console.error(`  ${violation.fromRelative}`);
      console.error(`    -> ${violation.toRelative}`);
      console.error(`    ${violation.detail}\n`);
    }
    console.error('Corrige el import o, si es deuda consciente, añade una excepción justificada en');
    console.error('scripts/check-architecture.mjs (docs/architecture/frontend-architecture.md).\n');
  }

  if (staleExceptions.length > 0) {
    console.error('Excepciones de frontera obsoletas: el import que las justificaba ya no existe.\n');
    for (const exception of staleExceptions) {
      console.error(`  ${exception.from} -> ${exception.to}`);
    }
    console.error('\nElimínalas de KNOWN_EXCEPTIONS en scripts/check-architecture.mjs.\n');
  }

  return 1;
}

process.exit(report(collectViolations()));
