import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/** `/` vira a página de compartilhamento do próprio passaporte (ou auth). */
export function HomeRedirect() {
  const { me, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper text-earth text-sm">
        Carregando…
      </div>
    )
  }
  if (me?.passport?.username) {
    return <Navigate to={`/p/${me.passport.username}`} replace />
  }
  return <Navigate to="/auth" replace />
}
