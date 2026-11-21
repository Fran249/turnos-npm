import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPackageVersion } from '../src/utils/version.js'

const CLI = fileURLToPath(new URL('./turnos.js', import.meta.url))

describe('turnos CLI --version', () => {
  it('reports the real package.json version through the public CLI interface', () => {
    const output = execFileSync(process.execPath, [CLI, '--version'], { encoding: 'utf8' }).trim()
    expect(output).toBe(getPackageVersion())
  })
})
