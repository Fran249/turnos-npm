import { createRequire } from 'node:module';

/**
 * Single source of truth for the published package version.
 *
 * Both the CLI banner (`bin/turnos.js --version`) and every generated
 * artifact read the version from package.json, so a release only has to bump
 * one field. A `createRequire` anchored to this module resolves package.json
 * from the installed package root, not from the consumer's cwd.
 */
const require = createRequire(import.meta.url);

export function getPackageVersion() {
  return require('../../package.json').version;
}

/** Replace the `v…` version token in a template literal with the real version. */
export function stampVersion(content) {
  return content.replace(/\{\{TURNOS_VERSION\}\}/g, getPackageVersion());
}
