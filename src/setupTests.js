import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL's auto-cleanup registers via the global afterEach, which only exists
// when vitest runs with `globals: true` (it doesn't here). Without this,
// rendered trees accumulate in document.body across tests and getBy*
// queries find elements from earlier tests ("Found multiple elements").
afterEach(() => cleanup())
