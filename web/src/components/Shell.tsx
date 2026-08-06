import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Shell({ children }: { children: React.ReactNode }) {
  const { me, logout } = useAuth()

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="border-b border-ink/20 bg-cream/90 backdrop-blur-sm sticky top-0 z-40 safe-top">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 py-3 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          <Link to="/" className="font-display text-base sm:text-lg tracking-wide text-ink shrink-0">
            Lume Maps
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3 text-sm min-w-0">
            {me ? (
              <>
                <Link
                  className="hover:text-stamp truncate max-w-[9rem] sm:max-w-none"
                  to={`/p/${me.passport.username}`}
                >
                  Meu passaporte
                </Link>
                <button type="button" onClick={logout} className="chip shrink-0">
                  Sair
                </button>
              </>
            ) : (
              <Link to="/auth" className="chip shrink-0">
                Criar conta
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 min-w-0">{children}</main>
      <footer className="border-t border-ink/15 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-xs text-earth/80">
        <div className="star-border w-full max-w-xs mx-auto mb-3 opacity-50" />
        Lume Maps
      </footer>
    </div>
  )
}
