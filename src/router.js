import { useEffect, useState } from 'react'

/**
 * Minimal path router (no dependency).
 *
 * The app has two surfaces, one per role:
 *   /user  -> the person booking (agenda + picker)
 *   /admin -> the person managing (register + stats)
 * `/` and any unknown path land on the user surface. Vite serves index.html
 * for unknown paths (appType: 'spa'), so real URLs work in dev and preview.
 */
export const NAV = [
  { to: '/user', label: 'Usuario' },
  { to: '/admin', label: 'Administrador' },
]

const ROUTES = NAV.map((item) => item.to)

/** '/user/' and '/user' are the same route; '/' and unknown paths are the user surface. */
export function normalize(pathname) {
  const path = String(pathname || '/').replace(/\/+$/, '') || '/'
  return ROUTES.includes(path) ? path : '/user'
}

export function navigate(to) {
  const path = normalize(to)
  if (window.location.pathname !== path) window.history.pushState({}, '', path)
  window.dispatchEvent(new Event('popstate'))
}

/** Click handler for <a href>: keeps middle-click and modifier-click native. */
export function go(to) {
  return (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (event.button && event.button !== 0) return
    event.preventDefault()
    navigate(to)
  }
}

export function usePath() {
  const [path, setPath] = useState(() => normalize(window.location.pathname))

  useEffect(() => {
    const sync = () => setPath(normalize(window.location.pathname))
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  return path
}
