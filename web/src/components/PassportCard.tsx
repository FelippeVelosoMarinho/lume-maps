import type { CSSProperties, ReactNode } from 'react'
import type { Passport, Stamp } from '../lib/api'
import { AnalogPhoto } from './AnalogPhoto'
import { formatPeriod } from '../lib/dates'

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR')
}

function stampDateLabel(stamp: Stamp) {
  const period = formatPeriod(stamp.journey_started_on, stamp.journey_ended_on)
  if (period) return period
  return new Date(stamp.stamped_at).toLocaleDateString('pt-BR')
}

function sealChromeStyle(colors: string[]): CSSProperties {
  if (colors.length === 0) return {}
  if (colors.length === 1) {
    return {
      borderColor: colors[0],
      color: colors[0],
    }
  }
  const grad = `linear-gradient(135deg, ${colors.join(', ')})`
  return {
    borderColor: 'transparent',
    color: colors[0],
    backgroundImage: `linear-gradient(var(--color-paper-aged), var(--color-paper-aged)), ${grad}`,
    backgroundOrigin: 'border-box',
    backgroundClip: 'padding-box, border-box',
  }
}

export function StampSeal({ stamp, size = 112 }: { stamp: Stamp; size?: number }) {
  const photo = stamp.primary_photo_url
  const colors = stamp.colors?.length ? stamp.colors : []
  return (
    <div
      className="stamp-seal p-2 relative overflow-hidden"
      style={{
        width: size,
        height: size,
        transform: `rotate(${stamp.rotation}deg)`,
        fontSize: size < 90 ? 9 : 11,
        ...sealChromeStyle(colors),
      }}
      title={
        stamp.journey_titles?.length
          ? `${stamp.label} — ${stamp.journey_titles.join(', ')}`
          : stamp.label
      }
    >
      {photo && (
        <div
          className="absolute inset-[10%] rounded-full bg-cover bg-center opacity-40"
          style={{
            backgroundImage: `url(${photo})`,
            boxShadow: colors.length ? `0 0 0 2px ${colors[0]}` : undefined,
          }}
          aria-hidden
        />
      )}
      <div className="relative z-[1] flex flex-col items-center justify-center h-full text-center">
        <div className="text-[9px] opacity-70">★</div>
        <div className="leading-tight px-1 font-semibold">{stamp.label}</div>
        <div className="text-[9px] mt-1 font-mono opacity-80">{stampDateLabel(stamp)}</div>
        {stamp.journey_titles && stamp.journey_titles.length > 1 ? (
          <div className="text-[8px] mt-0.5 opacity-70 line-clamp-2 px-1">
            {stamp.journey_titles.join(' · ')}
          </div>
        ) : (
          stamp.journey_title && (
            <div className="text-[8px] mt-0.5 opacity-60 line-clamp-1 px-1">{stamp.journey_title}</div>
          )
        )}
      </div>
    </div>
  )
}

function StarFrame({ children }: { children: ReactNode }) {
  return (
    <article className="passport-card paper-grain relative bg-paper">
      <div className="passport-stars passport-stars--top" aria-hidden />
      <div className="passport-stars passport-stars--bottom" aria-hidden />
      <div className="passport-stars passport-stars--left" aria-hidden />
      <div className="passport-stars passport-stars--right" aria-hidden />
      <div className="passport-card__inner relative z-[1]">{children}</div>
    </article>
  )
}

export function PassportCard({ passport }: { passport: Passport }) {
  return (
    <StarFrame>
      <div className="grid md:grid-cols-[150px_1fr] gap-5 md:gap-7 items-start">
        <div className="flex flex-col items-center gap-2">
          {passport.photo_url ? (
            <AnalogPhoto
              src={passport.photo_url}
              alt={passport.display_name}
              imgClassName="h-40 w-36"
              className="!rotate-0"
            />
          ) : (
            <div className="w-36 h-40 border border-dashed border-ink/40 bg-sand/40 flex items-center justify-center text-earth/60 text-xs text-center p-3">
              Sem foto
            </div>
          )}
          <p className="text-[10px] text-ink/80 text-center leading-snug max-w-[9rem]">
            Fotografia do viajante autorizado
          </p>
        </div>

        <div className="relative min-w-0">
          <h1 className="font-display text-lg md:text-xl uppercase tracking-wide leading-tight text-ink">
            Licença Permanente de Viagem
          </h1>
          <p className="font-mono text-sm text-stamp mt-1.5">{passport.passport_number}</p>

          <dl className="mt-4 space-y-2.5 text-sm">
            <Field label="Emitido para" value={passport.display_name} handwritten />
            <Field label="Usuário" value={`@${passport.username}`} />
            <Field label="Data de nascimento" value={formatDate(passport.date_of_birth)} />
            <Field label="Local de emissão" value={passport.place_of_issue || '—'} handwritten />
            <Field label="Data de emissão" value={formatDate(passport.issued_at)} />
          </dl>

          <div className="mt-5 relative pr-0 md:pr-28">
            <p className="font-mono text-[11px] uppercase tracking-wider text-center text-ink mb-1.5">
              Licença de viagem
            </p>
            <p className="font-mono text-[11px] md:text-xs leading-relaxed text-ink/90 text-justify">
              Certifica-se que a pessoa nomeada e descrita acima está autorizada a viajar e explorar
              livremente, salvo se retida pela lei.
            </p>
            <p className="font-mono text-[11px] uppercase tracking-wider text-center text-ink mt-3 mb-1.5">
              Importante
            </p>
            <p className="font-mono text-[11px] md:text-xs leading-relaxed text-ink/90 text-justify">
              {passport.bio?.trim()
                ? passport.bio
                : 'O portador desta licença registra mapas, lugares e memórias de suas viagens no Lume Maps, salvo indicação em contrário.'}
            </p>

            <div
              className="passport-ink-stamp absolute -right-1 md:right-0 top-[42%] -translate-y-1/2 pointer-events-none select-none"
              aria-hidden
            >
              <span>Lume Maps</span>
              <span className="passport-ink-stamp__sub">perdidos juntos</span>
            </div>
          </div>

          <div className="mt-8 max-w-[240px]">
            <p className="font-script text-3xl text-ink leading-none doc-field pb-1">
              {passport.signature || passport.display_name}
            </p>
            <p className="text-[10px] text-ink/80 mt-1.5">Assinatura do viajante autorizado</p>
          </div>
        </div>
      </div>
    </StarFrame>
  )
}

function Field({
  label,
  value,
  handwritten,
}: {
  label: string
  value: string
  handwritten?: boolean
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 items-end doc-field">
      <dt className="text-[11px] text-ink/75">{label}</dt>
      <dd className={handwritten ? 'font-script text-2xl leading-none' : 'font-medium'}>{value}</dd>
    </div>
  )
}
