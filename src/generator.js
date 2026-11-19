import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Install-time generator: creates the consumer-side artifacts of `turnos`
 * (user component, admin component, provider config, design css, provider
 * schema). Invoked from `bin/turnos.js` (init | postinstall).
 *
 * Templates live in <pkg>/templates/ — copied, never templated: the
 * provider-specific config is chosen wholesale by provider so consumers
 * never mix Firebase and Supabase code.
 */
/**
 * Where the templates live. Real node runtime (CLI/postinstall): the module
 * URL is `file:`. Under Vite/vitest the URL is virtual (`http://localhost`),
 * so fall back to <cwd>/templates — vitest is always run from the package
 * root.
 */
function resolveTemplatesDir() {
  try {
    if (new URL(import.meta.url).protocol === 'file:') {
      return fileURLToPath(new URL('../templates/', import.meta.url));
    }
  } catch {
    /* not a parseable module URL: use the cwd fallback */
  }
  return path.resolve(process.cwd(), 'templates');
}

const TEMPLATES_DIR = resolveTemplatesDir();

/** Consumer-relative paths created by a single init. */
export const GENERATED_FILES = {
  common: [
    'src/turnos/TurnoPicker.jsx',
    'src/turnos/TurnoAdmin.jsx',
    'src/turnos/turnos.css',
    'src/turnos/turnos.config.js',
  ],
  firebase: ['firestore.rules'],
  supabase: ['supabase-migrations/0001_turnos.sql'],
};

/** target -> template source, for the provider-agnostic files. */
const TEMPLATE_SOURCES = {
  'src/turnos/TurnoPicker.jsx': 'TurnoPicker.jsx',
  'src/turnos/TurnoAdmin.jsx': 'TurnoAdmin.jsx',
  'src/turnos/turnos.css': 'turnos.css',
};

/** One config file per provider, written to the same consumer path. */
const CONFIG_SOURCES = {
  supabase: 'config.turnos.supabase.js',
  firebase: 'config.turnos.firebase.js',
  memory: 'config.turnos.memory.js',
};

/** Extra provider artifact (schema / rules). */
const EXTRA_SOURCES = {
  supabase: { 'supabase-migrations/0001_turnos.sql': 'sql/0001_turnos.sql' },
  firebase: { 'firestore.rules': 'rules/firestore.rules' },
};

/**
 * Where does a consumer's project root live when npm runs postinstall?
 * INIT_CWD is the directory the user typed the install in;
 * npm_config_local_prefix is the package root under install;
 * bare node falls back to cwd (dev + tests).
 */
export function resolveTargetDir() {
  return process.env.INIT_CWD || process.env.npm_config_local_prefix || process.cwd();
}

export async function generateFiles({ provider, targetDir, force = false, demoSeed } = {}) {
  if (provider !== 'supabase' && provider !== 'firebase' && provider !== 'memory') {
    throw new Error(`proveedor desconocido: "${provider}". Usa --firebase, --supabase o --memory.`);
  }
  const targets = [...GENERATED_FILES.common];
  if (GENERATED_FILES[provider]) targets.push(...GENERATED_FILES[provider]);

  // Self guard: refuse to write artifacts into the turnos package itself
  // (e.g. `npm i` run from a git clone where package.json name === 'turnos').
  try {
    const pkg = JSON.parse(await fsp.readFile(path.join(targetDir, 'package.json'), 'utf8'));
    if (pkg.name === 'turnos') {
      return { self: true, generated: [], skipped: [], provider, targetDir };
    }
  } catch {
    /* no package.json (scratch dir in tests): proceed */
  }

  const generated = [];
  const skipped = [];
  for (const rel of targets) {
    const srcRel =
      rel === 'src/turnos/turnos.config.js'
        ? CONFIG_SOURCES[provider]
        : (EXTRA_SOURCES[provider]?.[rel] || TEMPLATE_SOURCES[rel]);
    const dst = path.join(targetDir, rel);
    const exists = await fsp.access(dst).then(() => true, () => false);
    if (exists && !force) {
      skipped.push(rel);
      continue;
    }
    await fsp.mkdir(path.dirname(dst), { recursive: true });
    let content = await fsp.readFile(path.join(TEMPLATES_DIR, srcRel), 'utf8');

    // Si es modo memoria y tiene demoSeed, inyectar las turns en el config generado
    if (provider === 'memory' && rel === 'src/turnos/turnos.config.js' && demoSeed) {
      const seedJSON = JSON.stringify(demoSeed, null, 2);
      content = content.replace(
        /turns:\s*\[[\s\S]*?\],/,
        `turns: ${seedJSON},`
      );
    }

    await fsp.writeFile(dst, content);
    generated.push(rel);
  }

  return { self: false, generated, skipped, provider, targetDir };
}
