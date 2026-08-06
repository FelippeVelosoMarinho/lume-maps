import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Shell({ children }: { children: React.ReactNode }) {
  const { me, logout } = useAuth()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-ink/20 bg-cream/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="font-display text-lg tracking-wide text-ink">
            Lume Maps
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            {me ? (
              <>
                <Link className="hover:text-stamp" to={`/p/${me.passport.username}`}>
                  Meu passaporte
                </Link>
                <button type="button" onClick={logout} className="chip">
                  Sair
                </button>
              </>
            ) : (
              <Link to="/auth" className="chip">
                Criar conta
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-ink/15 py-6 text-center text-xs text-earth/80">
        <div className="star-border w-full max-w-xs mx-auto mb-3 opacity-50" />
        Lume Maps — ficarmos perdidos juntos
      </footer>
    </div>
  )
}
