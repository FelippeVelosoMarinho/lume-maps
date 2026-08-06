import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { api, type Journey, type Marker } from '../lib/api'
import { formatPeriod } from '../lib/dates'
import { toast } from '../lib/notify'
import { useAuth } from '../contexts/AuthContext'
import { WarmMap } from '../components/DarkMap'
import { PlaceSheet } from '../components/PlaceSheet'
import { StampDock } from '../components/StampDock'
import { JourneyEditMenu, JourneyMenuButton } from '../components/JourneyEditMenu'

type Mode = 'edit' | 'view'

export function JourneyPage({ mode }: { mode: Mode }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { me, loading: authLoading } = useAuth()
  const [journey, setJourney] = useState<Journey | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [headerMore, setHeaderMore] = useState(false)

  const load = useCallback(async () => {
    if (!slug) return
    try {
      const data = mode === 'edit' ? await api.getJourneyEdit(slug) : await api.getJourney(slug)
      setJourney(data)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    }
  }, [slug, mode])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!journey) return
    document.title = `${journey.title} — Lume Maps`
    const desc = journey.subtitle || `Mapa: ${journey.title}`
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', desc)
  }, [journey])

  useEffect(() => {
    if (!headerMore) return
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement | null
      if (t?.closest?.('[data-header-more]')) return
      setHeaderMore(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [headerMore])

  // Visitante autenticado: ao abrir o mapa, entra automaticamente (aparece no passaporte)
  useEffect(() => {
    if (!slug || authLoading || !me?.passport || !journey) return
    if (me.passport.username === journey.owner_username) return
    const already = (journey.companions ?? []).some((c) => c.username === me.passport.username)
    if (already) return
    let cancelled = false
    void api
      .joinJourney(slug)
      .then((res) => {
        if (cancelled) return
        if (res.joined) {
          toast.success('Mapa adicionado ao seu passaporte')
          setJourney(res.journey)
        }
      })
      .catch(() => {
        /* silencioso — sem conta ou mapa privado */
      })
    return () => {
      cancelled = true
    }
    // Só reage a identidade do mapa / sessão — evita loop com setJourney
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, authLoading, me?.passport.username, journey?.id, journey?.owner_username, journey?.companions])

  if (mode === 'edit' && !authLoading && !me) {
    return <Navigate to="/auth" replace />
  }

  const selected: Marker | undefined = journey?.markers.find((m) => m.id === selectedId)
  const period = journey ? formatPeriod(journey.started_on, journey.ended_on) : ''
  const isOwner = !!me && me.passport.username === journey?.owner_username
  const isCompanion = !!me && (journey?.companions ?? []).some((c) => c.username === me.passport.username)
  const canEdit = isOwner || isCompanion
  const sheetOpen = !!selected || menuOpen

  async function deliverMap() {
    if (!me?.passport) {
      toast.error('Para compartilhar, você precisa ter um passaporte registrado.')
      navigate('/auth')
      return
    }
    const url = `${window.location.origin}/v/${slug}`
    try {
      if (navigator.share) {
        await navigator.share({
          title: journey?.title,
          text: journey?.subtitle || 'Veja o mapa desta viagem',
          url,
        })
        return
      }
      await navigator.clipboard.writeText(url)
      toast.success('Link do mapa copiado')
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(url)
        toast.success('Link do mapa copiado')
      } catch {
        toast.error('Não foi possível copiar o link')
      }
    }
  }

  function openMenu() {
    setSelectedId(null)
    setMenuOpen(true)
    setHeaderMore(false)
  }

  function selectPlace(id: string) {
    setMenuOpen(false)
    setSelectedId(id)
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-sand/40 text-ink">
      <header className="shrink-0 bg-paper text-ink border-b border-ink/20 z-20 safe-top">
        <div className="flex items-start justify-between gap-2 px-3 py-2">
          <div className="min-w-0 flex items-center gap-2 flex-1">
            {journey?.color && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                style={{ background: journey.color }}
                aria-hidden
              />
            )}
            <div className="min-w-0">
              <p className="font-display text-sm md:text-base leading-snug line-clamp-2">
                {journey?.title || '…'}
              </p>
              <p className="text-[11px] text-earth truncate">
                {journey?.owner_display_name && (
                  <Link className="text-stamp hover:underline" to={`/p/${journey.owner_username}`}>
                    @{journey.owner_username}
                  </Link>
                )}
                {period && <span> · {period}</span>}
              </p>
            </div>
          </div>

          {/* Desktop actions */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => void deliverMap()} className="chip">
              Compartilhar
            </button>
            {mode === 'view' && canEdit && (
              <Link to={`/v/${slug}/edit`} className="chip">
                Editar
              </Link>
            )}
            {mode === 'edit' && (
              <>
                <JourneyMenuButton onClick={openMenu} />
                <Link to={`/v/${slug}`} className="chip">
                  Ver público
                </Link>
              </>
            )}
          </div>

          {/* Mobile: primary + overflow */}
          <div className="flex sm:hidden items-center gap-1.5 shrink-0 relative" data-header-more>
            {mode === 'edit' ? (
              <JourneyMenuButton onClick={openMenu} />
            ) : canEdit ? (
              <Link to={`/v/${slug}/edit`} className="chip">
                Editar
              </Link>
            ) : (
              <button type="button" onClick={() => void deliverMap()} className="chip">
                Share
              </button>
            )}
            <button
              type="button"
              className="chip !px-2.5"
              aria-label="Mais ações"
              aria-expanded={headerMore}
              onClick={() => setHeaderMore((v) => !v)}
            >
              <MoreHorizontal size={16} />
            </button>
            {headerMore && (
              <div className="absolute right-0 top-full mt-1 z-30 min-w-[10rem] doc-frame bg-paper shadow-lg py-1 text-sm">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2.5 hover:bg-sand/50"
                  onClick={() => {
                    setHeaderMore(false)
                    void deliverMap()
                  }}
                >
                  Compartilhar
                </button>
                {mode === 'edit' && (
                  <Link
                    to={`/v/${slug}`}
                    className="block px-3 py-2.5 hover:bg-sand/50"
                    onClick={() => setHeaderMore(false)}
                  >
                    Ver público
                  </Link>
                )}
                {journey?.owner_username && (
                  <Link
                    to={`/p/${journey.owner_username}`}
                    className="block px-3 py-2.5 hover:bg-sand/50"
                    onClick={() => setHeaderMore(false)}
                  >
                    Passaporte
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {error && <div className="bg-red-100 text-red-900 text-sm px-4 py-2">{error}</div>}

      <div className="relative flex-1 min-h-0">
        {journey && (
          <WarmMap
            key={`map-${journey.id}-${journey.color || 'default'}`}
            markers={journey.markers}
            selectedId={selectedId}
            onSelect={selectPlace}
            flyTo={flyTo}
            pathColor={journey.color || undefined}
            bottomPad={sheetOpen ? 220 : 48}
          />
        )}

        {selected && slug && journey && (
          <PlaceSheet
            key={
              selected.id +
              selected.annotations.length +
              selected.attachments.map((a) => `${a.id}:${a.is_primary}`).join(',')
            }
            marker={selected}
            slug={slug}
            editable={mode === 'edit'}
            expeditionLabel={journey.title}
            expeditionDate={journey.started_on || journey.ended_on}
            onClose={() => setSelectedId(null)}
            onChanged={() => void load()}
            onDeliverMap={() => void deliverMap()}
          />
        )}

        {mode === 'edit' && slug && journey && (
          <>
            <StampDock
              slug={slug}
              markers={journey.markers}
              onChanged={load}
              onSelect={selectPlace}
              onStamped={(m) => setFlyTo({ lat: m.lat, lng: m.lng })}
              hidden={sheetOpen}
            />
            <JourneyEditMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              journey={journey}
              slug={slug}
              isOwner={isOwner}
              onSelectPlace={selectPlace}
              onChanged={async (j) => {
                if (j) setJourney(j)
                else await load()
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
