import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Music2, Share2, Users } from 'lucide-react'
import { journeyAuthorPhotos, mediaUrl, type Journey, type Marker } from '../lib/api'
import { formatPeriod } from '../lib/dates'
import { WarmMap } from './DarkMap'
import { PlaceModal } from './PlaceModal'
import { MarkdownText } from './MarkdownText'
import { PhotoStack, journeyPhotoStackUrls } from './JourneyInviteView'

type Props = {
  journey: Journey
  canJoin?: boolean
  joining?: boolean
  onJoin?: () => void
}

/** Convite + exibições + mapa interativo (diferente do perfil). */
export function JourneySharedExplore({
  journey,
  canJoin,
  joining,
  onJoin,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const period = formatPeriod(journey.started_on, journey.ended_on)
  const owner = journey.owner_username
  const companions = journey.companions ?? []
  const next = encodeURIComponent(`/v/${journey.slug}`)
  const selected: Marker | undefined = journey.markers.find((m) => m.id === selectedId)
  const shareUrl = `${window.location.origin}/v/${journey.slug}`
  const stackUrls = journeyPhotoStackUrls(journey)
  const playlist = journey.playlist_url?.trim() || ''

  async function deliverMap() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: journey.title,
          text: owner ? `@${owner} te chama pra essa viagem no Lume Maps` : journey.title,
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
    <div className="journey-shared-page h-[100dvh] flex flex-col bg-sand/30 text-ink">
      <section className="journey-shared-invite shrink-0 overflow-y-auto border-b border-ink/15 bg-paper paper-grain safe-top">
        <div className="max-w-3xl mx-auto px-3 sm:px-5 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start">
            <div className="w-full sm:w-[min(42%,14rem)] shrink-0">
              {stackUrls.length > 0 ? (
                <PhotoStack
                  urls={stackUrls}
                  label={
                    stackUrls.length > 1
                      ? `${Math.min(stackUrls.length, 5)} fotos`
                      : journey.title.slice(0, 28)
                  }
                />
              ) : (
                <div className="aspect-[4/3] border border-dashed border-ink/20 bg-sand/40 flex items-center justify-center text-xs text-earth/70 rounded-sm">
                  {journey.markers.length}{' '}
                  {journey.markers.length === 1 ? 'lugar' : 'lugares'} no caminho
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 w-full text-center sm:text-left space-y-2.5">
              <p className="text-[9px] uppercase tracking-[0.22em] text-stamp">Convite de viagem</p>
              <h1 className="font-display text-lg sm:text-xl leading-snug">
                {owner ? (
                  <>
                    @{owner} te chama pra essa viagem{' '}
                    <span aria-hidden>🗺</span>
                  </>
                ) : (
                  <>Te chamaram pra essa viagem</>
                )}
              </h1>
              <p className="font-display text-base text-ink/90">{journey.title}</p>
              {period && <p className="font-mono text-xs text-earth">{period}</p>}
              {journey.subtitle && (
                <div className="text-sm text-earth max-h-20 overflow-y-auto">
                  <MarkdownText className="text-[13px]">{journey.subtitle}</MarkdownText>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                {canJoin ? (
                  <button
                    type="button"
                    disabled={joining}
                    onClick={onJoin}
                    className="rounded-xl bg-earth text-cream px-5 py-2.5 text-sm font-medium disabled:opacity-60"
                  >
                    {joining ? 'Entrando…' : 'Entrar no mapa'}
                  </button>
                ) : (
                  <>
                    <Link
                      to={`/auth?mode=signup&next=${next}`}
                      className="rounded-xl bg-earth text-cream px-5 py-2.5 text-sm font-medium"
                    >
                      Criar passaporte e entrar
                    </Link>
                    <Link to={`/auth?mode=login&next=${next}`} className="text-xs text-stamp hover:underline">
                      Já tenho conta
                    </Link>
                  </>
                )}
                <button
                  type="button"
                  className="chip inline-flex items-center gap-1"
                  onClick={() => void deliverMap()}
                >
                  <Share2 size={14} />
                  Compartilhar
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-4 sm:gap-6 border-t border-dashed border-ink/15 pt-4">
            <section className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-earth mb-2 flex items-center gap-1">
                <Users size={12} /> Quem já está
              </p>
              <ul className="flex flex-wrap gap-2">
                {owner && (
                  <li>
                    <Link
                      to={`/p/${owner}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-2.5 py-1 text-xs hover:bg-sand/50"
                    >
                      <span className="font-medium text-stamp">@{owner}</span>
                      <span className="text-earth/60">criou</span>
                    </Link>
                  </li>
                )}
                {companions.map((c) => (
                  <li key={c.user_id}>
                    <Link
                      to={`/p/${c.username}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-2.5 py-1 text-xs hover:bg-sand/50"
                    >
                      {c.photo_url ? (
                        <img
                          src={mediaUrl(c.photo_url) || c.photo_url}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-sand flex items-center justify-center text-[9px]">
                          {c.display_name.slice(0, 1)}
                        </span>
                      )}
                      <span>@{c.username}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {playlist && (
              <section className="sm:w-48 shrink-0">
                <p className="text-[10px] uppercase tracking-wider text-earth mb-1 flex items-center gap-1">
                  <Music2 size={12} /> Playlist
                </p>
                <a href={playlist} target="_blank" rel="noreferrer" className="text-sm text-stamp hover:underline">
                  Ouvir trilha
                </a>
              </section>
            )}

            <section className="sm:w-36 shrink-0 text-xs text-earth">
              <p className="text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
                <MapPin size={12} /> Rota
              </p>
              <span className="font-mono">
                {journey.markers.length} {journey.markers.length === 1 ? 'cidade' : 'cidades'}
              </span>
              {journey.color && (
                <span
                  className="inline-block w-2 h-2 rounded-full ml-2 align-middle"
                  style={{ background: journey.color }}
                  aria-hidden
                />
              )}
            </section>
          </div>

          <p className="mt-3 text-[10px] text-earth/70 text-center sm:text-left">
            Explore o mapa abaixo — clique nas cidades e nos comentários. Ao entrar, o mapa aparece no seu passaporte.
          </p>
        </div>
      </section>

      <div className="relative flex-1 min-h-0">
        <div className="absolute top-2 left-3 z-[500] pointer-events-none">
          <span className="text-[10px] uppercase tracking-wider text-earth bg-paper/92 border border-ink/15 px-2.5 py-1 rounded-full shadow-sm">
            Mapa da viagem
          </span>
        </div>

        <WarmMap
          markers={journey.markers}
          selectedId={selectedId}
          onSelect={setSelectedId}
          pathColor={journey.color || undefined}
          isPlanning={!!journey.is_planning}
          showCommentBubbles
          authorPhotos={journeyAuthorPhotos(journey)}
          bottomPad={48}
        />
      </div>

      {selected && (
        <PlaceModal
          key={
            selected.id +
            selected.annotations.length +
            selected.attachments.map((a) => `${a.id}:${a.is_primary}`).join(',')
          }
          marker={selected}
          journey={journey}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
