import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import App from './App.jsx'
import { demoAdapter } from './demoAdapter.js'
import { __resetStoreForTests } from './store.js'

/**
 * The app has two surfaces, not three:
 *   /user  (and /) -> agenda + TurnoPicker  (the person booking)
 *   /admin         -> TurnoAdmin           (the person managing)
 * Both go through the same client, so a booking made in /user is the same
 * data the admin register reads.
 */
function goTo(path) {
  window.history.pushState({}, '', path)
}

function resetStore() {
  localStorage.removeItem('turnos:turns:v1')
  __resetStoreForTests()
}

describe('role surfaces share one data set', () => {
  beforeEach(() => {
    goTo('/')
    resetStore()
  })

  afterEach(() => {
    resetStore()
    goTo('/')
  })

  it('/ and /user land on the same user surface', async () => {
    const first = render(<App />)
    expect(await screen.findByTestId('turno-picker')).toBeInTheDocument()
    first.unmount()

    goTo('/user')
    render(<App />)
    expect(await screen.findByTestId('turno-picker')).toBeInTheDocument()
  })

  it('an unknown path falls back to the user surface', async () => {
    goTo('/no-existe')
    render(<App />)
    expect(await screen.findByTestId('turno-picker')).toBeInTheDocument()
  })

  it('/admin renders the admin component', async () => {
    goTo('/admin')
    render(<App />)
    expect(await screen.findByTestId('turno-admin')).toBeInTheDocument()
  })

  it('navigates between surfaces through the top bar', async () => {
    goTo('/admin')
    render(<App />)
    fireEvent.click(screen.getByRole('link', { name: 'Usuario' }))
    await waitFor(() => expect(window.location.pathname).toBe('/user'))
    expect(await screen.findByTestId('turno-picker')).toBeInTheDocument()
  })

  it('keeps one shared client: a booking is visible through the same adapter', async () => {
    const [turn] = await demoAdapter.listTurnos()
    expect(turn).toBeTruthy()
    const res = await demoAdapter.bookTurno(turn.id, 'Elsil')
    expect(res.ok).toBe(true)
    const booked = (await demoAdapter.listTurnos()).find((t) => t.id === turn.id)
    expect(booked.booked).toContain('Elsil')
  })
})
