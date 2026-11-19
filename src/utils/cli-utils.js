import { execSync } from 'child_process';
import fs from 'fs';

export function getPackageManager() {
  if (fs.existsSync('package-lock.json')) return 'npm';
  if (fs.existsSync('pnpm-lock.yaml')) return 'pnpm';
  if (fs.existsSync('yarn.lock')) return 'yarn';
  if (fs.existsSync('bun.lockb')) return 'bun';
  return 'npm';
}

export function installDependencies(dependencies) {
  const pm = getPackageManager();
  const installCmd = pm === 'npm' ? 'install' : 'add';
  const command = `${pm} ${installCmd} ${dependencies.join(' ')}`;

  console.log(`\nEjecutando: ${command}...`);
  execSync(command, { stdio: 'inherit' });
}
