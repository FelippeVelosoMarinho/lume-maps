import { Link } from 'react-router-dom'
import { Music2, Users } from 'lucide-react'
import type { Journey } from '../lib/api'
import { mediaUrl } from '../lib/api'
import { formatPeriod } from '../lib/dates'
import { WarmMap } from './DarkMap'

type Props = {
  journey: Journey
}

const STACK_ROTATIONS = [-8, 5, -3, 7, -5] as const
const STACK_SHIFTS = [
  { x: -18, y: 10 },
  { x: 16, y: 14 },
  { x: -8, y: 8 },
  { x: 12, y: 18 },
  { x: -4, y: 6 },
] as const

/** Pilha de fotos da viagem (substitui o mapinha na landing). */
function PhotoStack({
  urls,
  label,
}: {
  urls: string[]
  label: string
}) {
  const stack = urls.slice(0, 5)
  if (stack.length === 0) return null

  return (
    <div className="photo-stack relative mx-auto w-full max-w-sm aspect-[4/3]">
      {stack.map((src, i) => {
        const fromBack = stack.length - 1 - i
        const rot = STACK_ROTATIONS[fromBack % STACK_ROTATIONS.length]
        const shift = STACK_SHIFTS[fromBack % STACK_SHIFTS.length]
        const isTop = i === stack.length - 1
        return (
          <div
            key={`${src}-${i}`}
            className="photo-stack__card absolute inset-[8%] overflow-hidden border border-ink/20 bg-paper shadow-md"
            style={{
              zIndex: i + 1,
              transform: isTop
                ? 'rotate(-1.5deg)'
                : `translate(${shift.x}px, ${shift.y}px) rotate(${rot}deg)`,
              opacity: isTop ? 1 : 0.92 - fromBack * 0.04,
            }}
          >
            <img src={src} alt="" className="w-full h-full object-cover" />
            {isTop && (
              <span className="absolute bottom-2 left-2 text-[10px] bg-paper/90 text-ink px-2 py-0.5 border border-ink/10">
                {label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
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

  const photoUrls = [
    ...(cover ? [cover] : []),
    ...photos
      .map((p) => mediaUrl(p.url))
      .filter((u): u is string => !!u && u !== cover),
  ]

  const stackUrls = photoUrls.length > 0 ? photoUrls : []
  const playlist = journey.playlist_url?.trim() || ''

  return (
    <div className="passport-invite min-h-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-3 sm:px-5 py-5 sm:py-8 flex flex-col gap-5 sm:gap-6">
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

        {/* Destaque: fotos empilhadas (ou mapa se não houver foto) */}
        <figure className="w-full relative">
          {stackUrls.length > 0 ? (
            <PhotoStack
              urls={stackUrls}
              label={
                stackUrls.length > 1
                  ? `${Math.min(stackUrls.length, 5)} fotos`
                  : journey.title.slice(0, 28)
              }
            />
          ) : journey.markers.length > 0 ? (
            <div className="h-[min(48dvh,22rem)] overflow-hidden border border-ink/15 rounded-sm shadow-md">
              <WarmMap
                markers={journey.markers}
                pathColor={journey.color || undefined}
                preview
                className="h-full w-full"
              />
            </div>
          ) : (
            <div className="h-48 sm:h-56 border border-dashed border-ink/25 bg-sand/30 flex items-center justify-center text-sm text-earth/60">
              {journey.markers.length}{' '}
              {journey.markers.length === 1 ? 'lugar' : 'lugares'} no caminho
            </div>
          )}
          <figcaption className="mt-3 flex items-center justify-between gap-2 text-[11px] text-earth px-0.5">
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

        <div className="flex flex-col gap-5 pb-10">
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

          {/* Mapa só como detalhe secundário, se houver fotos empilhadas no destaque */}
          {stackUrls.length > 0 && journey.markers.length > 0 && (
            <section>
              <p className="text-[10px] uppercase tracking-wider text-earth mb-2">Caminho no mapa</p>
              <div className="h-40 sm:h-48 overflow-hidden border border-ink/15 rounded-sm">
                <WarmMap
                  markers={journey.markers}
                  pathColor={journey.color || undefined}
                  preview
                  className="h-full w-full"
                />
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
