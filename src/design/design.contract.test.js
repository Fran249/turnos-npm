import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { describe, it, expect } from 'vitest'

/**
 * DESIGN CONTRACT
 * ---------------
 * The app must be minimalist, in warm beige + white tones.
 *
 * This test does not mock or render anything: it reads the light-theme
 * `:root` block of `src/index.css`, resolves the primitive->semantic CSS
 * custom properties, and asserts the neutral family is WARM (beige/cream),
 * never the cool blue-gray that the previous design used.
 *
 * The CSS variable architecture (raw HSL triple -> primitive -> semantic)
 * is preserved by the codebase, so this is the single machine-readable
 * source of truth for "beige + white".
 */

const CSS = readFileSync(resolvePath(process.cwd(), 'src/index.css'), 'utf8')
const TPL_CSS = readFileSync(resolvePath(process.cwd(), 'templates/turnos.css'), 'utf8')

// The light theme is the first `:root` block, which lives before any `@media`.
// `--background`/`--ink`/etc. in that block point at `--primitive-*` leaves.
function lightRootDecls(css) {
  const light = css.split('@media')[0]
  const root = light.match(/:root\s*\{([\s\S]*?)\}/)
  if (!root) throw new Error('No top-level :root block found in index.css')
  const map = {}
  const re = /(--[A-Za-z0-9_-]+)\s*:\s*([^;]+);/g
  let m
  while ((m = re.exec(root[1]))) map[m[1]] = m[2].trim()
  return map
}

// Follow `var(--x)` references down to a leaf literal.
function resolve(name, decls, seen = new Set()) {
  if (seen.has(name)) return null
  seen.add(name)
  const val = decls[name]
  if (val == null) return null
  const ref = val.match(/^var\((--[A-Za-z0-9_-]+)\)\s*$/)
  return ref ? resolve(ref[1], decls, seen) : val
}

// Parse an `H S% L%` HSL triple into numbers.
function hsl(val) {
  const m = String(val || '').match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/)
  if (!m) return null
  return { h: +m[1], s: +m[2], l: +m[3] }
}

// A hue is "cool" (blue/teal) in the 190-280 range; beige/white neutrals
// must never land there.
const isCoolHue = (h) => h >= 190 && h <= 280
const isWhite = (t) => t && t.s <= 4

const NEUTRAL_FAMILY = ['background', 'card', 'ink', 'border', 'input', 'muted', 'subtle', 'foreground']

describe('design contract: system typography, zero external fonts', () => {
  const decls = lightRootDecls(CSS)

  it('declares a system serif display face in the light root', () => {
    expect(decls['--font-display']).toMatch(/Georgia/)
  })

  it('never loads external fonts or webfonts (package stays offline)', () => {
    for (const css of [CSS, TPL_CSS]) {
      expect(css).not.toMatch(/@import\s+url|@import\s+['"]http|fonts\.googleapis|@font-face/i)
    }
  })

  it('the generated template pins a system serif + tabular numerals, without ALL-CAPS labels', () => {
    expect(TPL_CSS).toMatch(/--turnos-serif/)
    expect(TPL_CSS).toMatch(/tabular-nums/)
    expect(TPL_CSS).not.toMatch(/text-transform/i)
  })

  it('leaves colours and typography to the installer (no palette in the template)', () => {
    // The package ships neutral defaults: currentColor / inherit. A consumer
    // themes it with its own tokens; shipping a palette would fight the host app.
    // Comments are documentation (they may show example values), so strip them.
    const decls = TPL_CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(decls).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(decls).not.toMatch(/\bhsl\(/)
    expect(decls).toMatch(/--turnos-font:\s*inherit/)
    expect(decls).toMatch(/--turnos-ink:\s*currentColor/)
    // Defaults live in a zero-specificity `:where()` so any consumer rule wins.
    expect(decls).toMatch(/:where\(\.turnos\)\s*\{/)
    // No forced dark palette: the consumer decides, not prefers-color-scheme.
    expect(TPL_CSS).not.toMatch(/prefers-color-scheme/)
  })
})

describe('design contract: minimalist beige + white', () => {
  const decls = lightRootDecls(CSS)
  const leaf = (name) => {
    const t = hsl(resolve('--' + name, decls))
    if (!t) throw new Error(`Could not resolve light-theme value for --${name}`)
    return t
  }

  it('has a warm, near-white background (not the old cool gray)', () => {
    const bg = leaf('background')
    expect(bg.l).toBeGreaterThanOrEqual(90) // very light
    expect(bg.l).toBeLessThanOrEqual(98)   // not pure white (that's the card)
    expect(bg.s).toBeGreaterThan(0)        // warm tint, not neutral gray
    expect(isCoolHue(bg.h)).toBe(false)    // not blue/teal
  })

  it('keeps cards pure white', () => {
    const card = leaf('card')
    expect(isWhite(card)).toBe(true)
  })

  it('uses a warm near-black ink for text', () => {
    const ink = leaf('ink')
    expect(ink.l).toBeLessThanOrEqual(25)
    expect(isCoolHue(ink.h)).toBe(false)
  })

  it('frames everything in warm beige, with no cool blue/teal neutrals', () => {
    for (const name of NEUTRAL_FAMILY) {
      const t = leaf(name)
      if (isWhite(t)) continue // white/gray have no hue to worry about
      expect(isCoolHue(t.h), `--${name} is cool (${t.h})`).toBe(false)
    }
    const border = leaf('border')
    expect(border.l).toBeGreaterThanOrEqual(82)
    expect(border.l).toBeLessThanOrEqual(97)
  })

  it('keeps the primitive->semantic architecture intact', () => {
    // Semantic tokens still reference primitives, so the palette can be
    // swapped wholesale (the convention this project is built on).
    expect(decls['--background']).toMatch(/var\(--/)
    expect(Object.keys(decls).filter((k) => k.startsWith('--primitive-')).length).toBeGreaterThan(0)
  })
})
