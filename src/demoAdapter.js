import { createLocalClient } from './localClient.js'

/**
 * The one client behind every demo surface.
 *
 * `/user` (agenda + picker) and `/admin` both consume this instance, which
 * reads and writes the app's localStorage store. Booking a turn in the agenda
 * updates the calendar, the week strip and the admin register; creating a
 * turn in the admin shows up for the person booking. One story, one data set.
 *
 * The seeded turns live in `src/store.js`; this file only wires the client.
 */
export const demoAdapter = createLocalClient()

/** Identidad con la que reserva la vista /user. */
export const demoUser = 'Elsil'
