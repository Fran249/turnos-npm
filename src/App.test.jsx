import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import App from './App.jsx'
import { __resetStoreForTests } from './store.js'

/**
 * Two surfaces, one per role. `/` and `/user` are the person booking;
 * `/admin` is the person managing. The store keeps a module-level cache, so
 * each test resets both localStorage and that cache.
 */
const STORE_KEY = 'turnos:turns:v1'

function resetStore() {
  localStorage.removeItem(STORE_KEY)
  __resetStoreForTests()
}

describe('App surfaces', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/')
    resetStore()
  })

  afterEach(resetStore)

  it('opens on the user surface: agenda + booking', async () => {
    render(<App />)
    expect(screen.getByText('Calendario de turnos')).toBeInTheDocument()
    expect(await screen.findByTestId('turno-picker')).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('does not offer management actions on the user surface', () => {
    render(<App />)
    expect(screen.queryByText('+ Añadir turno')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Estadísticas' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('turno-admin')).not.toBeInTheDocument()
  })

  it('/admin renders the management surface', async () => {
    window.history.pushState({}, '', '/admin')
    render(<App />)
    expect(await screen.findByTestId('turno-admin')).toBeInTheDocument()
    expect(screen.getByText('Administración')).toBeInTheDocument()
    expect(screen.queryByTestId('turno-picker')).not.toBeInTheDocument()
  })
})
