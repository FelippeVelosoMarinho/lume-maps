import { Link } from 'react-router-dom'
import { Music2, Users } from 'lucide-react'
import type { Journey } from '../lib/api'
import { mediaUrl } from '../lib/api'
import { formatPeriod } from '../lib/dates'
import { WarmMap } from './DarkMap'
import { AnalogPhoto } from './AnalogPhoto'

type Props = {
  journey: Journey
}

/** Landing de compartilhamento: chamada acima, capa em destaque. */
export function JourneyInviteView({ journey }: Props) {
  const period = formatPeriod(journey.started_on, journey.ended_on)
  const owner = journey.owner_username
  const companions = journey.companions ?? []
  const next = encodeURIComponent(`/v/${journey.slug}`)

  const cover = journey.cover_url ? mediaUrl(journey.cover_url) : null
  const photos = journey.markers
    .flatMap((m) =>
      (m.attachments ?? [])
        .filter((a) => a.kind === 'photo')
        .map((a) => ({ url: a.url, title: m.title, primary: a.is_primary })),
    )
    .sort((a, b) => Number(b.primary) - Number(a.primary))

  const hero = cover || (photos[0] ? mediaUrl(photos[0].url) : null)
  const playlist = journey.playlist_url?.trim() || ''

  return (
    <div className="passport-invite min-h-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-3 sm:px-5 py-5 sm:py-8 flex flex-col gap-5 sm:gap-6">
        {/* Chamada */}
        <header className="flex flex-col items-center text-center gap-2 sm:gap-3">
          <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.22em] text-stamp">Lume Maps</p>
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl leading-[1.2] text-ink max-w-xl">
            {owner ? (
              <>
                @{owner} te chama pra essa viagem…
                <span className="ml-1" aria-hidden>
                  🗺
                </span>
              </>
            ) : (
              <>Te chamaram pra essa viagem…</>
            )}
          </h1>
          <p className="font-display text-base sm:text-lg text-ink/85 leading-snug max-w-lg">
            {journey.title}
          </p>
          {(journey.subtitle || period) && (
            <p className="text-sm text-earth max-w-md leading-snug">
              {journey.subtitle}
              {journey.subtitle && period ? ' · ' : ''}
              {period && <span className="font-mono text-xs">{period}</span>}
            </p>
          )}
          <div className="pt-1 flex flex-col items-center gap-1.5">
            <Link
              to={`/auth?mode=signup&next=${next}`}
              className="inline-flex items-center justify-center rounded-xl bg-earth text-cream px-6 py-2.5 text-sm font-medium shadow-sm hover:brightness-110 min-h-11"
            >
              Criar passaporte e entrar
            </Link>
            <p className="text-[11px] text-earth/80">
              Já tem conta?{' '}
              <Link className="text-stamp hover:underline" to={`/auth?mode=login&next=${next}`}>
                Entrar
              </Link>
            </p>
          </div>
        </header>

        {/* Preview da capa — destaque principal */}
        <figure className="w-full relative">
          {hero ? (
            <div className="journey-invite-hero overflow-hidden border border-ink/20 bg-sand/40 shadow-md">
              <img
                src={hero}
                alt={journey.title}
                className="w-full h-[min(58dvh,28rem)] sm:h-[min(62dvh,32rem)] object-cover"
              />
            </div>
          ) : (
            <div className="journey-invite-hero h-48 sm:h-56 border border-dashed border-ink/25 bg-sand/30 flex items-center justify-center text-sm text-earth/60">
              {journey.markers.length}{' '}
              {journey.markers.length === 1 ? 'lugar' : 'lugares'} no caminho
            </div>
          )}
          <figcaption className="mt-2 flex items-center justify-between gap-2 text-[11px] text-earth px-0.5">
            <span className="flex items-center gap-2 min-w-0">
              {journey.color && (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: journey.color }}
                  aria-hidden
                />
              )}
              {owner ? (
                <Link to={`/p/${owner}`} className="text-stamp hover:underline truncate">
                  @{owner}
                </Link>
              ) : (
                <span>—</span>
              )}
            </span>
            <span className="font-mono shrink-0">
              {journey.markers.length} {journey.markers.length === 1 ? 'lugar' : 'lugares'}
            </span>
          </figcaption>
        </figure>

        {/* Detalhes secundários */}
        <div className="flex flex-col gap-5 pb-10">
          {journey.markers.length > 0 && (
            <section>
              <p className="text-[10px] uppercase tracking-wider text-earth mb-2">Prévia do mapa</p>
              <div className="h-48 sm:h-56 overflow-hidden border border-ink/15 rounded-sm">
                <WarmMap
                  markers={journey.markers}
                  pathColor={journey.color || undefined}
                  preview
                  className="h-full w-full"
                />
              </div>
            </section>
          )}

          {playlist && (
            <section className="flex items-start gap-2">
              <Music2 size={16} className="text-stamp shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-earth">Playlist</p>
                <a
                  href={playlist}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-stamp hover:underline"
                >
                  Ouvir a trilha da viagem
                </a>
              </div>
            </section>
          )}

          <section>
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
              {owner && companions.length === 0 && (
                <li className="text-xs text-earth/60">Por enquanto só quem criou.</li>
              )}
            </ul>
          </section>

          {photos.length > 1 && (
            <section>
              <p className="text-[10px] uppercase tracking-wider text-earth mb-2">Mais imagens</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.slice(0, 12).map((p, i) => (
                  <div key={`${p.url}-${i}`} className="shrink-0 relative" title={p.title}>
                    <AnalogPhoto src={p.url} thumb imgClassName="h-16 w-16" className="!rotate-0" />
                    {cover && mediaUrl(p.url) === cover && (
                      <span className="absolute top-0.5 left-0.5 z-[2] text-[8px] bg-earth text-cream px-1 rounded">
                        capa
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <p className="text-[10px] text-earth/70 text-center leading-snug max-w-sm mx-auto">
            Ao entrar, você é adicionado ao mapa e ele aparece no seu passaporte.
          </p>
        </div>
      </div>
    </div>
  )
}
