import { describe, it, expect } from 'vitest'
import { createClient } from './index.js'

/**
 * Spec for the client registry (stage 1: memory only;
 * 'firebase'/'supabase' cases are added in stages 4–5 when adapters land).
 * Intended RED: src/core/index.js does not exist yet.
 */
describe('createClient registry', () => {
  it('defaults to the memory provider when no provider is given', () => {
    expect(createClient({}).provider).toBe('memory')
    expect(createClient({ provider: 'memory' }).provider).toBe('memory')
  })

  it('rejects unknown providers with a descriptive error', () => {
    expect(() => createClient({ provider: 'nebase' })).toThrowError(/proveedor desconocido/)
  })
})
