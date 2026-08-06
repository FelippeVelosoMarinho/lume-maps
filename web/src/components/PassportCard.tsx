import type { ChangeEvent, CSSProperties, ReactNode } from 'react'
import { Camera } from 'lucide-react'
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
  const repeats = Math.max(
    1,
    stamp.journey_titles?.length || colors.length || 1,
  )
  const starCount = Math.min(repeats, 5)
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
          ? `${stamp.label} — ${stamp.journey_titles.join(', ')}${
              repeats > 1 ? ` (${repeats}×)` : ''
            }`
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
        <div
          className="opacity-70 tracking-[0.05em] leading-none"
          style={{ fontSize: starCount > 3 ? 7 : 9 }}
          aria-hidden
        >
          {'★'.repeat(starCount)}
        </div>
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

function StarFrame({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <article className={`passport-card paper-grain relative bg-paper ${className}`}>
      <div className="passport-stars passport-stars--top" aria-hidden />
      <div className="passport-stars passport-stars--bottom" aria-hidden />
      <div className="passport-stars passport-stars--left" aria-hidden />
      <div className="passport-stars passport-stars--right" aria-hidden />
      <div className="passport-card__inner relative z-[1]">{children}</div>
    </article>
  )
}

type PassportCardProps = {
  passport: Passport
  /** Dono: permite trocar a foto no hover da fotografia */
  onPhotoChange?: (file: File) => void | Promise<void>
  /**
   * `ticket` — formato retangular largo (estilo Call Me If You Get Lost),
   * usado na tela de convite.
   */
  variant?: 'default' | 'ticket'
}

export function PassportCard({
  passport,
  onPhotoChange,
  variant = 'default',
}: PassportCardProps) {
  if (variant === 'ticket') {
    return <PassportTicket passport={passport} />
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void onPhotoChange?.(file)
  }

  return (
    <StarFrame>
      <div className="grid md:grid-cols-[150px_1fr] gap-5 md:gap-7 items-start">
        <div className="flex flex-col items-center gap-2">
          {onPhotoChange ? (
            <label className="passport-photo-edit group cursor-pointer block relative">
              <input type="file" accept="image/*" className="sr-only" onChange={onFile} />
              {passport.photo_url ? (
                <AnalogPhoto
                  src={passport.photo_url}
                  alt={passport.display_name}
                  imgClassName="h-40 w-36"
                  className="!rotate-0 pointer-events-none"
                />
              ) : (
                <div className="w-36 h-40 border border-dashed border-ink/40 bg-sand/40 flex items-center justify-center text-earth/60 text-xs text-center p-3">
                  Sem foto
                </div>
              )}
              <span className="passport-photo-edit__overlay" aria-hidden>
                <Camera size={22} strokeWidth={1.75} />
                <span className="text-[11px] font-medium mt-1">Trocar foto</span>
              </span>
              <span className="sr-only">Trocar fotografia do viajante</span>
            </label>
          ) : passport.photo_url ? (
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

          <div className="mt-5 relative md:pr-28">
            <p className="font-mono text-[11px] uppercase tracking-wider text-center text-ink mb-1.5">
              Licença de viagem
            </p>
            <p className="font-mono text-[11px] md:text-xs leading-relaxed text-ink/90 text-justify">
              Certifica-se que a pessoa nomeada e descrita acima está autorizada a viajar, circular e
              explorar livremente, salvo se impedida por lei.
            </p>
            <p className="font-mono text-[11px] uppercase tracking-wider text-center text-ink mt-3 mb-1.5">
              Aviso importante
            </p>
            <p className="font-mono text-[11px] md:text-xs leading-relaxed text-ink/90 text-justify">
              O portador desta licença registra os mapas, caminhos e memórias de suas viagens neste
              modesto espaço como e quando bem entender, salvo indicação em contrário.
            </p>

            <div
              className="passport-ink-stamp mt-5 mx-auto md:mt-0 md:mx-0 md:absolute md:right-0 md:top-[42%] md:-translate-y-1/2 pointer-events-none select-none"
              aria-hidden
            >
              <span>Lume Maps</span>
              <span className="passport-ink-stamp__sub">{passport.passport_number}</span>
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

/** Passaporte retangular largo — tela de convite / estética CMIYGL. */
function PassportTicket({ passport }: { passport: Passport }) {
  return (
    <StarFrame className="passport-card--ticket">
      <div className="passport-ticket">
        <aside className="passport-ticket__photo">
          {passport.photo_url ? (
            <AnalogPhoto
              src={passport.photo_url}
              alt={passport.display_name}
              imgClassName="h-[7.5rem] w-[6.5rem] sm:h-36 sm:w-32"
              className="!rotate-0"
            />
          ) : (
            <div className="h-[7.5rem] w-[6.5rem] sm:h-36 sm:w-32 border border-dashed border-ink/40 bg-sand/40 flex items-center justify-center text-earth/60 text-[10px] text-center p-2">
              Sem foto
            </div>
          )}
          <p className="text-[8px] sm:text-[9px] text-ink/70 text-center leading-snug mt-1 max-w-[6.5rem]">
            Fotografia do viajante
          </p>
        </aside>

        <div className="passport-ticket__body min-w-0">
          <header className="passport-ticket__header">
            <div className="min-w-0 flex-1 pr-2">
              <h1 className="font-display text-[0.7rem] sm:text-sm uppercase tracking-[0.04em] leading-tight text-ink">
                Licença Permanente de Viagem
              </h1>
              <p className="font-mono text-[10px] sm:text-xs text-stamp mt-0.5">
                {passport.passport_number}
              </p>
            </div>
            <div className="passport-ink-stamp passport-ink-stamp--ticket pointer-events-none select-none shrink-0" aria-hidden>
              <span>Lume Maps</span>
              <span className="passport-ink-stamp__sub">{passport.passport_number}</span>
            </div>
          </header>

          <dl className="passport-ticket__fields">
            <FieldCompact label="Emitido para" value={passport.display_name} handwritten />
            <FieldCompact label="Usuário" value={`@${passport.username}`} />
            <FieldCompact label="Nascimento" value={formatDate(passport.date_of_birth)} />
            <FieldCompact label="Emissão" value={passport.place_of_issue || '—'} handwritten />
            <FieldCompact label="Data" value={formatDate(passport.issued_at)} />
          </dl>

          <div className="passport-ticket__notes">
            <p className="font-mono text-[8px] uppercase tracking-wider text-ink/70">Licença</p>
            <p className="font-mono text-[8px] sm:text-[9px] leading-snug text-ink/85 line-clamp-2">
              Autorizado a viajar, circular e explorar livremente, salvo se impedido por lei.
            </p>
            <p className="font-mono text-[8px] uppercase tracking-wider text-ink/70 mt-1.5">
              Importante
            </p>
            <p className="font-mono text-[8px] sm:text-[9px] leading-snug text-ink/85 line-clamp-3">
              O portador registra mapas, caminhos e memórias neste espaço como e quando bem
              entender, salvo indicação em contrário.
            </p>
          </div>

          <div className="passport-ticket__sign">
            <p className="font-script text-xl sm:text-2xl text-ink leading-none doc-field pb-0.5 inline-block min-w-[8rem]">
              {passport.signature || passport.display_name}
            </p>
            <p className="text-[8px] text-ink/65 mt-0.5">Assinatura do viajante</p>
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
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(7rem,140px)_minmax(0,1fr)] gap-0.5 sm:gap-2 items-end doc-field min-w-0">
      <dt className="text-[11px] text-ink/75">{label}</dt>
      <dd className={`min-w-0 break-words ${handwritten ? 'font-script text-2xl leading-none' : 'font-medium'}`}>
        {value}
      </dd>
    </div>
  )
}

function FieldCompact({
  label,
  value,
  handwritten,
}: {
  label: string
  value: string
  handwritten?: boolean
}) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] sm:grid-cols-[6.5rem_minmax(0,1fr)] gap-1 items-end doc-field min-w-0 py-0.5">
      <dt className="text-[8px] sm:text-[9px] text-ink/65 leading-tight">{label}</dt>
      <dd
        className={`min-w-0 break-words text-[11px] sm:text-xs leading-tight ${
          handwritten ? 'font-script text-base sm:text-lg' : 'font-medium'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
