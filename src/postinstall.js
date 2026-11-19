import { generateFiles, resolveTargetDir } from './generator.js';

/**
 * npm `postinstall` entry. npm never forwards unknown CLI flags to
 * postinstall, so the provider arrives via the environment:
 *   TURNOS_PROVIDER=firebase npm i turnos
 * The hook is STRICTLY WARN-ONLY: whatever happens it returns a status
 * string and never throws — a broken postinstall would break `npm i`
 * in every consumer project.
 */
export function resolveProvider(env = process.env) {
  const p = String(env.TURNOS_PROVIDER || '').toLowerCase();
  return p === 'firebase' || p === 'supabase' ? p : null;
}

export async function runPostinstall({
  env = process.env,
  targetDir,
  log = console.log,
  gen = generateFiles,
} = {}) {
  const dir = targetDir || resolveTargetDir();
  const provider = resolveProvider(env);

  if (!provider) {
    log('turnos: no se detectó TURNOS_PROVIDER. Para generar los componentes:');
    log('  npx turnos init --firebase   # Firestore');
    log('  npx turnos init --supabase   # Supabase');
    return 'guidance';
  }

  try {
    const res = await gen({ provider, targetDir: dir });
    if (res.self) {
      log('turnos: postinstall descartado (contexto del propio paquete "turnos").');
      return 'skipped';
    }
    log(`turnos: archivos generados para ${provider}: ${res.generated.join(', ') || 'ninguno (ya existían)'}`);
    if (res.skipped.length > 0) log(`turnos: omitidos porque ya existían: ${res.skipped.join(', ')}`);
    return 'generated';
  } catch (err) {
    log(`turnos: no se pudieron generar los archivos (${err.message}). Ejecuta: npx turnos init --${provider}`);
    return 'error';
  }
}
