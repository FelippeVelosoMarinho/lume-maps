import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, type Me } from '../lib/api'

type AuthCtx = {
  me: Me | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => void
  login: (email: string, password: string) => Promise<void>
  signup: (data: {
    email: string
    password: string
    username: string
    display_name: string
    place_of_issue?: string
    signature?: string
  }) => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!api.isAuthed) {
      setMe(null)
      setLoading(false)
      return
    }
    try {
      const data = await api.me()
      setMe(data)
    } catch {
      api.setTokens(null)
      setMe(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<AuthCtx>(
    () => ({
      me,
      loading,
      refresh,
      logout: () => {
        api.setTokens(null)
        setMe(null)
      },
      login: async (email, password) => {
        const tokens = await api.login(email, password)
        api.setTokens(tokens)
        await refresh()
      },
      signup: async (data) => {
        const tokens = await api.signup(data)
        api.setTokens(tokens)
        await refresh()
      },
    }),
    [me, loading, refresh],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth outside provider')
  return ctx
}
