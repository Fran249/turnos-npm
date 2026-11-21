import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { getPackageVersion } from '../src/utils/version.js'

const CLI = path.resolve(process.cwd(), 'bin/turnos.js')

describe('turnos CLI --version', () => {
  it('reports the real package.json version through the public CLI interface', () => {
    const output = execFileSync(process.execPath, [CLI, '--version'], { encoding: 'utf8' }).trim()
    expect(output).toBe(getPackageVersion())
  })
})
