import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Shell } from '../components/Shell'

export function AuthPage() {
  const { login, signup, me, loading } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && me) nav(`/p/${me.passport.username}`, { replace: true })
  }, [me, loading, nav])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      if (mode === 'login') {
        await login(String(fd.get('email')), String(fd.get('password')))
        // refresh sets me; effect navigates
      } else {
        const username = String(fd.get('username')).toLowerCase()
        await signup({
          email: String(fd.get('email')),
          password: String(fd.get('password')),
          username,
          display_name: String(fd.get('display_name')),
          place_of_issue: String(fd.get('place_of_issue') || ''),
          signature: String(fd.get('signature') || ''),
        })
        nav(`/p/${username}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="paper-grain doc-frame bg-paper p-6">
          <h1 className="font-display text-2xl uppercase">
            {mode === 'signup' ? 'Criar conta' : 'Entrar'}
          </h1>
          <p className="text-sm text-earth mt-1">
            {mode === 'signup'
              ? 'Crie sua conta e o passaporte para guardar seus mapas.'
              : 'Entre para editar seus mapas.'}
          </p>

          <form className="mt-6 space-y-3" onSubmit={onSubmit}>
            {mode === 'signup' && (
              <>
                <Field name="display_name" label="Nome completo" required />
                <Field name="username" label="Username (link público)" required pattern="[a-zA-Z0-9_]+" />
                <Field name="place_of_issue" label="Local de emissão" placeholder="ex.: Ouro Preto" />
                <Field name="signature" label="Assinatura" placeholder="Como assina" />
              </>
            )}
            <Field name="email" label="Email" type="email" required />
            <Field name="password" label="Senha" type="password" required minLength={6} />

            {error && (
              <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-sky py-3 font-medium disabled:opacity-50"
            >
              {busy ? '…' : mode === 'signup' ? 'Criar conta' : 'Entrar'}
            </button>
          </form>

          <button
            type="button"
            className="mt-4 text-sm text-stamp underline"
            onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
          >
            {mode === 'signup' ? 'Já tenho conta' : 'Criar uma conta'}
          </button>
          <div className="star-border mt-5 opacity-60" />
        </div>
        <p className="text-center text-xs text-earth mt-4">
          <Link to="/">← Voltar</Link>
        </p>
      </div>
    </Shell>
  )
}

function Field(props: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, className, ...rest } = props
  return (
    <label className="block text-sm">
      <span className="text-[11px] uppercase tracking-wide text-earth">{label}</span>
      <input
        className={`mt-1 w-full rounded-xl border border-ink/20 bg-cream/70 px-3 py-2 outline-none focus:border-sky ${className ?? ''}`}
        {...rest}
      />
    </label>
  )
}
