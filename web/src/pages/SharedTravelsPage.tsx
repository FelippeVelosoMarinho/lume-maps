import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, UserPlus, X } from 'lucide-react'
import {
  api,
  JOURNEY_COLOR_PALETTE,
  type PassportSearchHit,
  type PassportTravels,
} from '../lib/api'
import { toast } from '../lib/notify'
import { useAuth } from '../contexts/AuthContext'
import { Shell } from '../components/Shell'
import { SharedTravelsMap, type TravelerLayer } from '../components/SharedTravelsMap'

type TravelerEntry = {
  username: string
  display_name: string
  photo_url: string | null
  travels: PassportTravels | null
  loading: boolean
  error?: string
}

function colorForIndex(i: number) {
  return JOURNEY_COLOR_PALETTE[i % JOURNEY_COLOR_PALETTE.length]
}

export function SharedTravelsPage() {
  const { me, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [travelers, setTravelers] = useState<TravelerEntry[]>([])
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PassportSearchHit[]>([])
  const [searchBusy, setSearchBusy] = useState(false)

  const usernamesFromUrl = useMemo(() => {
    const raw = params.getAll('u').map((u) => u.trim().toLowerCase()).filter(Boolean)
    return [...new Set(raw)]
  }, [params])

  const syncUrl = (names: string[]) => {
    const next = new URLSearchParams()
    for (const u of names) next.append('u', u)
    setParams(next, { replace: true })
  }

  // Bootstrap from URL (+ self if logged in and URL empty)
  useEffect(() => {
    if (authLoading) return

    if (usernamesFromUrl.length === 0 && me?.passport.username) {
      syncUrl([me.passport.username])
      return
    }

    const wanted = new Set(usernamesFromUrl)

    setTravelers((prev) => {
      const kept = prev.filter((t) => wanted.has(t.username))
      const have = new Set(kept.map((t) => t.username))
      const additions: TravelerEntry[] = []
      for (const u of usernamesFromUrl) {
        if (have.has(u)) continue
        additions.push({
          username: u,
          display_name: u,
          photo_url: null,
          travels: null,
          loading: true,
        })
      }
      return [...kept, ...additions]
    })

    for (const u of usernamesFromUrl) {
      void (async () => {
        try {
          const [passport, travels] = await Promise.all([
            api.getPassport(u).catch(() => null),
            api.getPassportTravels(u),
          ])
          setTravelers((prev) =>
            prev.map((t) =>
              t.username === u
                ? {
                    ...t,
                    display_name: passport?.display_name || travels.display_name || t.display_name,
                    photo_url: passport?.photo_url ?? t.photo_url,
                    travels,
                    loading: false,
                    error: undefined,
                  }
                : t,
            ),
          )
        } catch (e) {
          setTravelers((prev) =>
            prev.map((t) =>
              t.username === u
                ? {
                    ...t,
                    loading: false,
                    error: e instanceof Error ? e.message : 'Não foi possível carregar',
                  }
                : t,
            ),
          )
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncUrl is stable enough via setParams
  }, [authLoading, usernamesFromUrl, me?.passport.username])

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([])
      return
    }
    if (!me) return
    const t = setTimeout(async () => {
      setSearchBusy(true)
      try {
        setHits(await api.searchPassports(q.trim()))
      } catch {
        setHits([])
      } finally {
        setSearchBusy(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, me])

  function addTraveler(hit: PassportSearchHit) {
    const key = hit.username.toLowerCase()
    if (usernamesFromUrl.includes(key) || travelers.some((t) => t.username === key)) {
      toast.error('Essa pessoa já está no mapa')
      return
    }
    syncUrl([...usernamesFromUrl, key])
    setQ('')
    setHits([])
  }

  function removeTraveler(username: string) {
    syncUrl(usernamesFromUrl.filter((u) => u !== username))
  }

  const layers: TravelerLayer[] = useMemo(
    () =>
      travelers
        .filter((t) => t.travels && !t.error)
        .map((t, i) => ({
          username: t.username,
          display_name: t.display_name,
          color: colorForIndex(i),
          journeys: t.travels?.journeys ?? [],
        })),
    [travelers],
  )

  if (authLoading) {
    return (
      <Shell>
        <p className="text-earth text-center py-16">Carregando…</p>
      </Shell>
    )
  }

  if (!me) {
    return (
      <Shell>
        <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
          <h1 className="font-display text-2xl uppercase">Mapa compartilhado</h1>
          <p className="text-earth text-sm">
            Entre na sua conta para montar um mapa com as trajetórias de outros viajantes.
          </p>
          <button
            type="button"
            className="inline-flex rounded-xl bg-earth text-cream px-5 py-2.5 text-sm font-medium"
            onClick={() => navigate('/auth?mode=login&next=/trajetos')}
          >
            Entrar
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="mx-auto max-w-5xl px-3 sm:px-4 py-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-earth mb-1">Trajetórias</p>
            <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-wide">
              Mapa compartilhado
            </h1>
            <p className="text-sm text-earth mt-1 max-w-xl">
              Adicione viajantes para ver onde todos passaram no mesmo mapa. A legenda mostra só os
              nomes.
            </p>
          </div>
          <Link to={`/p/${me.passport.username}`} className="text-sm text-stamp hover:underline shrink-0">
            Voltar ao passaporte
          </Link>
        </div>

        <section className="paper-grain doc-frame bg-paper p-4 md:p-5 space-y-4">
          <div>
            <label className="text-[11px] uppercase text-earth flex items-center gap-1.5">
              <UserPlus size={12} /> Adicionar viajante
            </label>
            <div className="relative mt-1 max-w-md">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-earth/60" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por @username ou nome"
                className="w-full border border-dashed border-ink/30 bg-cream pl-8 pr-2 py-2 text-sm outline-none focus:border-stamp"
              />
              {(hits.length > 0 || searchBusy) && (
                <ul className="absolute z-20 left-0 right-0 mt-1 border border-ink/15 bg-cream max-h-52 overflow-auto text-sm shadow-md">
                  {searchBusy && hits.length === 0 && (
                    <li className="px-3 py-2 text-xs text-earth">Buscando…</li>
                  )}
                  {hits.map((h) => (
                    <li key={h.username}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-sand/50 border-b border-ink/5"
                        onClick={() => addTraveler(h)}
                      >
                        <span className="font-medium text-stamp">@{h.username}</span>
                        <span className="text-earth/80 block text-xs">{h.display_name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <ul className="flex flex-wrap gap-2">
            {travelers.map((t, i) => (
              <li
                key={t.username}
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-cream pl-2.5 pr-1 py-1 text-sm"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: colorForIndex(i) }}
                  aria-hidden
                />
                <span className="font-medium">{t.display_name}</span>
                <span className="text-[10px] text-earth">@{t.username}</span>
                {t.loading && <span className="text-[10px] text-earth">…</span>}
                <button
                  type="button"
                  className="p-1.5 rounded-full hover:bg-sand text-earth"
                  aria-label={`Remover ${t.display_name}`}
                  onClick={() => removeTraveler(t.username)}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>

          {travelers.some((t) => t.error) && (
            <ul className="text-xs text-red-800 space-y-1">
              {travelers
                .filter((t) => t.error)
                .map((t) => (
                  <li key={t.username}>
                    @{t.username}: {t.error}
                  </li>
                ))}
            </ul>
          )}

          <SharedTravelsMap layers={layers} defaultExpanded={false} />
        </section>
      </div>
    </Shell>
  )
}
