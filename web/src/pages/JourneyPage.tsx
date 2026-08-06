import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { api, type Journey, type Marker } from '../lib/api'
import { formatPeriod } from '../lib/dates'
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

  if (mode === 'edit' && !authLoading && !me) {
    return <Navigate to="/auth" replace />
  }

  const selected: Marker | undefined = journey?.markers.find((m) => m.id === selectedId)
  const period = journey ? formatPeriod(journey.started_on, journey.ended_on) : ''
  const isOwner = !!me && me.passport.username === journey?.owner_username
  const isCompanion = !!me && (journey?.companions ?? []).some((c) => c.username === me.passport.username)
  const canEdit = isOwner || isCompanion

  async function deliverMap() {
    if (!me?.passport) {
      alert('Para compartilhar um link, você precisa ter um passaporte registrado.')
      navigate('/auth')
      return
    }
    const url = `${window.location.origin}/v/${slug}`
    if (navigator.share) {
      await navigator.share({
        title: journey?.title,
        text: journey?.subtitle || 'Veja o mapa desta viagem',
        url,
      })
    } else {
      await navigator.clipboard.writeText(url)
      alert('Link do mapa copiado!')
    }
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-sand/40 text-ink">
      <header className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 bg-paper text-ink border-b border-ink/20 z-20">
        <div className="min-w-0 flex items-center gap-2">
          {journey?.color && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: journey.color }}
              aria-hidden
            />
          )}
          <div className="min-w-0">
            <p className="font-display text-sm md:text-base truncate">{journey?.title || '…'}</p>
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
        <div className="flex items-center gap-2 shrink-0">
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
              <JourneyMenuButton onClick={() => setMenuOpen(true)} />
              <Link to={`/v/${slug}`} className="chip">
                Ver público
              </Link>
            </>
          )}
        </div>
      </header>

      {error && <div className="bg-red-100 text-red-900 text-sm px-4 py-2">{error}</div>}

      <div className="relative flex-1 min-h-0">
        {journey && (
          <WarmMap
            key={`map-${journey.id}-${journey.color || 'default'}`}
            markers={journey.markers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            flyTo={flyTo}
            pathColor={journey.color || undefined}
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
              onSelect={setSelectedId}
              onStamped={(m) => setFlyTo({ lat: m.lat, lng: m.lng })}
            />
            <JourneyEditMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              journey={journey}
              slug={slug}
              isOwner={isOwner}
              onSelectPlace={setSelectedId}
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
