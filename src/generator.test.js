import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, writeFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { generateFiles, resolveTargetDir, GENERATED_FILES } from './generator.js'

/**
 * Spec for the install-time generator: `npx turnos init --firebase|--supabase`
 * and `postinstall` (via TURNOS_PROVIDER) must create, in the CONSUMER's
 * project root: a user component (TurnoPicker), an admin component
 * (TurnoAdmin), the provider config, the design css, and provider artifacts
 * (Supabase migration / Firestore rules). No real credentials ever.
 * Intended RED: src/generator.js does not exist yet.
 */
const fileExists = (p) => access(p).then(() => true, () => false)

describe('generateFiles', () => {
  let dir

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'turnos-gen-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('exposes a stable file map (consumer-relative paths)', () => {
    expect(GENERATED_FILES.common).toEqual([
      'src/turnos/TurnoPicker.jsx',
      'src/turnos/TurnoAdmin.jsx',
      'src/turnos/turnos.css',
      'src/turnos/turnos.config.js',
    ])
    expect(GENERATED_FILES.firebase).toEqual(['firestore.rules'])
    expect(GENERATED_FILES.supabase).toEqual(['supabase-migrations/0001_turnos.sql'])
  })

  it('supabase: creates picker, admin, css, config and the migration SQL; no firestore rules', async () => {
    const res = await generateFiles({ provider: 'supabase', targetDir: dir })
    for (const rel of GENERATED_FILES.common) {
      expect(res.generated).toContain(rel)
      expect(await fileExists(path.join(dir, rel))).toBe(true)
    }
    expect(await fileExists(path.join(dir, 'supabase-migrations/0001_turnos.sql'))).toBe(true)
    expect(await fileExists(path.join(dir, 'firestore.rules'))).toBe(false)
    const cfg = await readFile(path.join(dir, 'src/turnos/turnos.config.js'), 'utf8')
    expect(cfg).toContain('supabase')
    expect(cfg).toContain('TU_ORG') // placeholder only — never real credentials
  })

  it('firebase: creates the same core files plus firestore.rules; no SQL migration', async () => {
    const res = await generateFiles({ provider: 'firebase', targetDir: dir })
    expect(res.generated).toContain('firestore.rules')
    expect(await fileExists(path.join(dir, 'supabase-migrations/0001_turnos.sql'))).toBe(false)
    const cfg = await readFile(path.join(dir, 'src/turnos/turnos.config.js'), 'utf8')
    expect(cfg).toContain('initializeApp')
    expect(cfg).toContain('getFirestore')
  })

  it('never overwrites existing files without force; with force it does', async () => {
    await generateFiles({ provider: 'supabase', targetDir: dir })
    const picker = path.join(dir, 'src/turnos/TurnoPicker.jsx')
    await writeFile(picker, 'MIO')
    const kept = await generateFiles({ provider: 'supabase', targetDir: dir })
    expect(kept.skipped).toContain('src/turnos/TurnoPicker.jsx')
    expect(await readFile(picker, 'utf8')).toBe('MIO')
    const forced = await generateFiles({ provider: 'supabase', targetDir: dir, force: true })
    expect(forced.generated).toContain('src/turnos/TurnoPicker.jsx')
    expect(await readFile(picker, 'utf8')).not.toBe('MIO')
  })

  it('no-ops when the target is the turnos package itself (self guard)', async () => {
    await writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'turnos' }))
    const res = await generateFiles({ provider: 'supabase', targetDir: dir })
    expect(res.self).toBe(true)
    expect(res.generated).toEqual([])
    expect(await fileExists(path.join(dir, 'src/turnos/turnos.config.js'))).toBe(false)
  })

  it('rejects unknown providers', async () => {
    await expect(generateFiles({ provider: 'couchdb', targetDir: dir }))
      .rejects.toThrowError(/proveedor/)
  })
})

describe('resolveTargetDir', () => {
  it('prefers INIT_CWD, then npm_config_local_prefix, then cwd', () => {
    const keys = ['INIT_CWD', 'npm_config_local_prefix']
    const saved = keys.map((k) => [k, process.env[k]])
    process.env.INIT_CWD = '/tmp/consumer'
    process.env.npm_config_local_prefix = '/other'
    expect(resolveTargetDir()).toBe('/tmp/consumer')
    delete process.env.INIT_CWD
    expect(resolveTargetDir()).toBe('/other')
    delete process.env.npm_config_local_prefix
    expect(resolveTargetDir()).toBe(process.cwd())
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })
})
