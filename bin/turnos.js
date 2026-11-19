#!/usr/bin/env node
import { Command } from 'commander';
import inquirer from 'inquirer';
import { generateFiles, resolveTargetDir } from '../src/generator.js';
import { runPostinstall } from '../src/postinstall.js';
import { installDependencies } from '../src/utils/cli-utils.js';
import { ENV_TEMPLATES } from '../src/utils/env-templates.js';
import fs from 'fs';
import path from 'path';

const PROVIDERS = [
  { name: 'firebase', value: 'firebase', label: 'Firebase (Firestore)' },
  { name: 'supabase', value: 'supabase', label: 'Supabase' },
  { name: 'memory', value: 'memory', label: 'Memoria (demo sin base de datos)' },
];

const DEMO_SEED = [
  {
    id: 'demo-1',
    title: 'Consulta médica general',
    staff: 'Dr. García',
    date: '2026-11-20',
    hour: '09:00',
    durationMin: 30,
    capacity: 1,
    priority: 'medium',
    status: 'pending',
    notes: 'Chequeo anual de rutina',
    booked: [],
  },
  {
    id: 'demo-2',
    title: 'Limpieza dental',
    staff: 'Dra. López',
    date: '2026-11-20',
    hour: '10:30',
    durationMin: 45,
    capacity: 1,
    priority: 'low',
    status: 'pending',
    notes: 'Limpieza profiláctica',
    booked: [],
  },
  {
    id: 'demo-3',
    title: 'Revisión de vista',
    staff: 'Dr. Méndez',
    date: '2026-11-20',
    hour: '14:00',
    durationMin: 20,
    capacity: 2,
    priority: 'high',
    status: 'pending',
    notes: 'Control de graduación',
    booked: [],
  },
];

const program = new Command();

program
  .name('turnos')
  .description('CLI para instalar y configurar turnos en tu proyecto')
  .version('0.3.1');

program
  .command('init')
  .description('Inicializa los componentes de turnos en tu proyecto')
  .option('-f, --force', 'Sobrescribir archivos existentes')
  .option('-d, --dir <ruta>', 'Directorio destino')
  .action(async (options) => {
    const { provider } = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: '¿Qué base de datos quieres usar?',
        choices: PROVIDERS,
      },
    ]);

    const targetDir = options.dir || resolveTargetDir();

    // Si es modo demo (memory), generar config con memoria y semilla de ejemplo
    if (provider === 'memory') {
      const res = await generateFiles({
        provider: 'memory',
        targetDir,
        force: options.force,
        demoSeed: DEMO_SEED,
      });

      // Generar .env.example vacío para modo demo (no hay credenciales)
      fs.writeFileSync(path.join(targetDir, '.env.example'), '# Modo demo: sin credenciales necesarias');

      if (res.self) {
        console.log('Estás en el propio paquete "turnos".');
        return;
      }

      res.generated.forEach((f) => console.log(`  + ${f}`));
      res.skipped.forEach((f) => console.log(`  = ${f} (ya existía)`));
      console.log(`\n✅ Modo demo activado (memoria). Los turnos se muestran pero no se pueden reservar hasta que configures Firebase o Supabase.`);
      return;
    }

    // Firebase o Supabase: generar config real, instalar dependencias y .env
    const res = await generateFiles({
      provider,
      targetDir,
      force: options.force,
    });

    // Automatizar instalación de dependencias
    const deps = provider === 'supabase' ? ['@supabase/supabase-js'] : provider === 'firebase' ? ['firebase'] : [];
    // Siempre asegurar que el propio paquete esté instalado en el proyecto local
    deps.push('@ffstack/turnos');
    installDependencies(deps);

    // Generar .env.example
    fs.writeFileSync(path.join(targetDir, '.env.example'), ENV_TEMPLATES[provider].trim());
    console.log(`\n  + .env.example creado con configuración para ${provider}`);

    if (res.self) {
      console.log('Estás en el propio paquete "turnos".');
      return;
    }

    res.generated.forEach((f) => console.log(`  + ${f}`));
    res.skipped.forEach((f) => console.log(`  = ${f} (ya existía)`));

    console.log(`\n¡Turnos inicializado con ${provider}!`);
  });

program
  .command('postinstall')
  .action(async () => {
    await runPostinstall({ targetDir: resolveTargetDir() });
  });

program.parse(process.argv);
