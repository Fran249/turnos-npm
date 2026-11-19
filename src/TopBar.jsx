import { NAV, go } from './router.js'

/**
 * Shared top bar: the wordmark and the route index. The demo dashboard and
 * both preview routes render it, so you can jump between surfaces at any time.
 */
export default function TopBar({ path }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <a href="/" onClick={go('/')} className="flex items-baseline gap-2">
          <span className="serif text-xl font-semibold tracking-tight">Turnos</span>
          <span className="text-moss serif text-xl font-semibold">·</span>
          <span className="hidden text-xs font-semibold text-subtle sm:inline">agenda de turnos</span>
        </a>
        <nav aria-label="Secciones" className="flex items-center gap-5">
          {NAV.map((item) => (
            <a
              key={item.to}
              href={item.to}
              onClick={go(item.to)}
              aria-current={path === item.to ? 'page' : undefined}
              className={`tab ${path === item.to ? 'tab-on' : ''}`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}
