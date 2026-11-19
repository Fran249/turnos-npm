import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { vi } from 'vitest'
import { mkdtemp, rm, writeFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { resolveProvider, runPostinstall } from './postinstall.js'
import { generateFiles } from './generator.js'

/**
 * Spec for the npm `postinstall` hook. `npm` never forwards unknown CLI
 * flags to postinstall, so the provider travels through the
 * `TURNOS_PROVIDER` env var (`TURNOS_PROVIDER=firebase npm i turnos`).
 * The hook is STRICTLY WARN-ONLY: it must never throw or exit non-zero,
 * or a bare `npm i turnos` would break in every consumer project.
 * Intended RED: src/postinstall.js does not exist yet.
 */
const fileExists = (p) => access(p).then(() => true, () => false)

describe('resolveProvider', () => {
  it('detects TURNOS_PROVIDER case-insensitively', () => {
    expect(resolveProvider({ TURNOS_PROVIDER: 'firebase' })).toBe('firebase')
    expect(resolveProvider({ TURNOS_PROVIDER: 'SUPABASE' })).toBe('supabase')
  })

  it('returns null when the variable is missing or not a known provider', () => {
    expect(resolveProvider({})).toBeNull()
    expect(resolveProvider({ TURNOS_PROVIDER: 'couchdb' })).toBeNull()
    expect(resolveProvider({ TURNOS_PROVIDER: '' })).toBeNull()
  })
})

describe('runPostinstall', () => {
  let dir

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'turnos-pi-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('prints install guidance when no provider is set, and never throws', async () => {
    const log = vi.fn()
    const res = await runPostinstall({ env: {}, targetDir: dir, log })
    expect(res).toBe('guidance')
    const out = log.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(out).toContain('npx turnos init --firebase')
    expect(out).toContain('npx turnos init --supabase')
    expect(await fileExists(path.join(dir, 'src/turnos'))).toBe(false) // nothing written
  })

  it('generates the provider files when TURNOS_PROVIDER is set (real generator, tmp consumer dir)', async () => {
    const log = vi.fn()
    const res = await runPostinstall({
      env: { TURNOS_PROVIDER: 'supabase' },
      targetDir: dir,
      log,
      gen: generateFiles, // the real generator
    })
    expect(res).toBe('generated')
    expect(await fileExists(path.join(dir, 'src/turnos/turnos.config.js'))).toBe(true)
    expect(await fileExists(path.join(dir, 'supabase-migrations/0001_turnos.sql'))).toBe(true)
    expect(log.mock.calls.join(' ')).toContain('supabase')
  })

  it('is a no-op that returns "skipped" when the target is the turnos package itself', async () => {
    await writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'turnos' }))
    const log = vi.fn()
    const res = await runPostinstall({
      env: { TURNOS_PROVIDER: 'firebase' },
      targetDir: dir,
      log,
      gen: generateFiles,
    })
    expect(res).toBe('skipped')
    expect(await fileExists(path.join(dir, 'firestore.rules'))).toBe(false)
  })

  it('never throws when the generator fails (postinstall must not break npm install)', async () => {
    const log = vi.fn()
    const gen = vi.fn().mockRejectedValue(new Error('disk on fire'))
    const res = await runPostinstall({
      env: { TURNOS_PROVIDER: 'firebase' },
      targetDir: '/any/path/never/touched',
      log,
      gen,
    })
    expect(res).toBe('error')
    expect(gen).toHaveBeenCalledTimes(1)
    expect(log.mock.calls.join(' ')).toContain('npx turnos init --firebase')
  })
})
