import { Link } from 'react-router-dom'
import type { Journey } from '../lib/api'
import { mediaUrl } from '../lib/api'
import { formatPeriod } from '../lib/dates'

type Props = {
  journey: Journey
}

/** Landing de compartilhamento do mapa — espelha o convite do passaporte. */
export function JourneyInviteView({ journey }: Props) {
  const period = formatPeriod(journey.started_on, journey.ended_on)
  const owner = journey.owner_username
  const others = (journey.companions ?? []).length
  const next = encodeURIComponent(`/v/${journey.slug}`)
  const cover = journey.cover_url ? mediaUrl(journey.cover_url) : null
  const primaryPhoto =
    journey.markers
      .flatMap((m) => m.attachments ?? [])
      .find((a) => a.kind === 'photo' && a.is_primary)?.url ||
    journey.markers.flatMap((m) => m.attachments ?? []).find((a) => a.kind === 'photo')?.url

  const photo = cover || (primaryPhoto ? mediaUrl(primaryPhoto) : null)

  return (
    <div className="passport-invite h-full min-h-0 overflow-hidden px-3 sm:px-6 lg:px-10">
      <div className="h-full min-h-0 max-w-6xl mx-auto flex flex-col md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)] md:gap-8 md:items-center py-3">
        <section className="min-w-0 shrink-0 flex flex-col justify-center gap-2.5 md:pr-2 order-1">
          <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.22em] text-stamp">Lume Maps</p>
          <h1 className="font-display text-lg sm:text-xl md:text-2xl lg:text-[1.85rem] leading-[1.2] text-ink max-w-md">
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
          <p className="font-display text-base sm:text-lg text-ink/90 leading-snug max-w-md">
            {journey.title}
          </p>
          <p className="text-xs text-earth">
            {period && <span>{period}</span>}
            {others > 0 && (
              <span>
                {period ? ' · ' : ''}
                {others} {others === 1 ? 'pessoa' : 'pessoas'} no mapa
              </span>
            )}
          </p>

          <div className="pt-2 space-y-2">
            <Link
              to={`/auth?mode=signup&next=${next}`}
              className="inline-flex items-center justify-center rounded-xl bg-earth text-cream px-5 py-2.5 text-sm font-medium shadow-sm hover:brightness-110 min-h-10"
            >
              Criar passaporte e entrar
            </Link>
            <p className="text-[11px] text-earth/80">
              Já tem conta?{' '}
              <Link className="text-stamp hover:underline" to={`/auth?mode=login&next=${next}`}>
                Entrar
              </Link>
            </p>
            <p className="text-[10px] text-earth/70 max-w-xs leading-snug hidden sm:block">
              Ao entrar, o mapa entra no seu passaporte automaticamente.
            </p>
          </div>
        </section>

        <section className="relative min-w-0 min-h-0 flex-1 flex items-center justify-center order-2 overflow-hidden">
          <article className="journey-invite-card w-full max-w-md paper-grain doc-frame bg-paper p-4 sm:p-5 shadow-md">
            {journey.color && (
              <span
                className="inline-block w-2.5 h-2.5 rounded-full mb-2"
                style={{ background: journey.color }}
                aria-hidden
              />
            )}
            <p className="font-display text-lg sm:text-xl leading-snug text-ink">{journey.title}</p>
            {journey.subtitle && (
              <p className="text-sm text-earth mt-1 line-clamp-2">{journey.subtitle}</p>
            )}
            {photo && (
              <div className="mt-4 overflow-hidden border border-ink/15 aspect-[4/3] bg-sand/40">
                <img src={photo} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            {!photo && (
              <div className="mt-4 h-28 border border-dashed border-ink/20 bg-sand/30 flex items-center justify-center text-xs text-earth/60">
                {journey.markers.length}{' '}
                {journey.markers.length === 1 ? 'lugar' : 'lugares'} no caminho
              </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-earth">
              {owner ? (
                <Link to={`/p/${owner}`} className="text-stamp hover:underline">
                  @{owner}
                </Link>
              ) : (
                <span>—</span>
              )}
              {period && <span className="font-mono">{period}</span>}
            </div>
          </article>
        </section>
      </div>
    </div>
  )
}
