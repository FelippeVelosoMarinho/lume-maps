import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Share2, Users } from 'lucide-react'
import type { Journey, Marker } from '../lib/api'
import { formatPeriod } from '../lib/dates'
import { WarmMap } from './DarkMap'
import { PlaceSheet } from './PlaceSheet'
import { MarkdownText } from './MarkdownText'

type Props = {
  journey: Journey
  /** Visitante logado pode entrar no mapa */
  canJoin?: boolean
  joining?: boolean
  onJoin?: () => void
  /** Dono/companheiro pode excluir comentários próprios */
  canDeleteComments?: boolean
  onChanged?: () => void
}

/** Mapa compartilhado interativo: pins clicáveis + balões de comentário. */
export function JourneySharedExplore({
  journey,
  canJoin,
  joining,
  onJoin,
  canDeleteComments,
  onChanged,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const period = formatPeriod(journey.started_on, journey.ended_on)
  const owner = journey.owner_username
  const companions = journey.companions ?? []
  const next = encodeURIComponent(`/v/${journey.slug}`)
  const selected: Marker | undefined = journey.markers.find((m) => m.id === selectedId)
  const sheetOpen = !!selected
  const shareUrl = `${window.location.origin}/v/${journey.slug}`

  async function deliverMap() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: journey.title,
          text: owner ? `@${owner} compartilhou esta viagem no Lume Maps` : journey.title,
          url: shareUrl,
        })
        return
      }
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-sand/40 text-ink">
      <header className="shrink-0 bg-paper border-b border-ink/20 z-20 safe-top">
        <div className="max-w-3xl mx-auto px-3 py-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-[0.2em] text-stamp">Mapa compartilhado</p>
              <h1 className="font-display text-base sm:text-lg leading-snug line-clamp-2">{journey.title}</h1>
              {owner && (
                <p className="text-xs text-earth mt-0.5">
                  por{' '}
                  <Link to={`/p/${owner}`} className="text-stamp hover:underline">
                    @{owner}
                  </Link>
                  {period ? ` · ${period}` : ''}
                </p>
              )}
            </div>
            <button type="button" className="chip shrink-0 inline-flex items-center gap-1" onClick={() => void deliverMap()}>
              <Share2 size={14} />
              <span className="hidden sm:inline">Compartilhar</span>
            </button>
          </div>

          {journey.subtitle && (
            <div className="text-xs text-earth max-h-16 overflow-y-auto">
              <MarkdownText>{journey.subtitle}</MarkdownText>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {canJoin ? (
              <button
                type="button"
                disabled={joining}
                onClick={onJoin}
                className="rounded-xl bg-earth text-cream px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                {joining ? 'Entrando…' : 'Entrar no mapa'}
              </button>
            ) : (
              <>
                <Link
                  to={`/auth?mode=signup&next=${next}`}
                  className="rounded-xl bg-earth text-cream px-4 py-2 text-sm font-medium"
                >
                  Criar passaporte
                </Link>
                <Link to={`/auth?mode=login&next=${next}`} className="text-xs text-stamp hover:underline">
                  Entrar
                </Link>
              </>
            )}
            {(owner || companions.length > 0) && (
              <span className="text-[10px] text-earth inline-flex items-center gap-1">
                <Users size={12} />
                {1 + companions.length} no mapa
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="relative flex-1 min-h-0">
        <WarmMap
          markers={journey.markers}
          selectedId={selectedId}
          onSelect={setSelectedId}
          pathColor={journey.color || undefined}
          isPlanning={!!journey.is_planning}
          showCommentBubbles
          bottomPad={sheetOpen ? 220 : 48}
        />

        {selected && (
          <PlaceSheet
            key={
              selected.id +
              selected.annotations.length +
              selected.attachments.map((a) => `${a.id}:${a.is_primary}`).join(',')
            }
            marker={selected}
            slug={journey.slug}
            editable={false}
            canDeleteAnnotations={canDeleteComments}
            expeditionLabel={journey.title}
            expeditionDate={journey.started_on || journey.ended_on}
            onClose={() => setSelectedId(null)}
            onChanged={() => onChanged?.()}
            onDeliverMap={() => void deliverMap()}
          />
        )}
      </div>
    </div>
  )
}
