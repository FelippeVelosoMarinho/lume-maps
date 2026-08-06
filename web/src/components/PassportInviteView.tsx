import { Link } from 'react-router-dom'
import type { Passport } from '../lib/api'
import { PassportCard } from './PassportCard'

const GHOST_PASSPORTS = [
  { name: 'Marina Costa', handle: '@marina.costa', rotate: -6, x: -22, y: 10, z: 1 },
  { name: 'João Ribeiro', handle: '@joaorib', rotate: 4, x: 26, y: 16, z: 2 },
  { name: 'Ana Luiza', handle: '@analu', rotate: -2.5, x: -6, y: 22, z: 3 },
] as const

function GhostPassport({
  name,
  handle,
  rotate,
  x,
  y,
  z,
}: {
  name: string
  handle: string
  rotate: number
  x: number
  y: number
  z: number
}) {
  return (
    <div
      className="passport-stack__ghost absolute inset-x-[4%] top-0 pointer-events-none select-none"
      style={{
        transform: `translate(${x}px, ${y}px) rotate(${rotate}deg)`,
        zIndex: z,
      }}
      aria-hidden
    >
      <article className="passport-card passport-card--ticket paper-grain relative bg-paper opacity-50">
        <div className="passport-stars passport-stars--top" />
        <div className="passport-stars passport-stars--bottom" />
        <div className="passport-stars passport-stars--left" />
        <div className="passport-stars passport-stars--right" />
        <div className="passport-card__inner relative z-[1]">
          <div className="passport-ticket passport-ticket--ghost">
            <div className="h-20 w-[4.5rem] sm:h-24 sm:w-24 border border-dashed border-ink/25 bg-sand/35 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2 py-0.5">
              <p className="font-display text-[9px] uppercase tracking-wide text-ink/55">
                Licença Permanente de Viagem
              </p>
              <p className="font-script text-lg text-ink/70 leading-none">{name}</p>
              <p className="font-mono text-[9px] text-stamp/70">{handle}</p>
              <div className="space-y-1 pt-1">
                <div className="h-1 w-[85%] bg-ink/10 rounded-full" />
                <div className="h-1 w-[60%] bg-ink/10 rounded-full" />
                <div className="h-1 w-[70%] bg-ink/10 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}

type Props = {
  passport: Passport
  showSignup: boolean
  myPassportHref?: string
}

/** Tela de convite: chamada à esquerda, pilha de passaportes retangulares à direita. */
export function PassportInviteView({ passport, showSignup, myPassportHref }: Props) {
  return (
    <div className="passport-invite h-full min-h-0 overflow-hidden px-3 sm:px-6 lg:px-10">
      <div className="h-full min-h-0 max-w-6xl mx-auto flex flex-col md:grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.25fr)] md:gap-6 lg:gap-8 md:items-center py-2 sm:py-3">
        <section className="min-w-0 shrink-0 flex flex-col justify-center gap-2 sm:gap-2.5 md:pr-2 order-1 max-md:pb-2">
          <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.22em] text-stamp">Lume Maps</p>
          <h1 className="font-display text-lg sm:text-xl md:text-2xl lg:text-[1.85rem] leading-[1.2] text-ink max-w-sm">
            {passport.display_name} te chama pra se perderem juntos…
            <span className="ml-1" aria-hidden>
              🥺
            </span>
          </h1>
          <p className="font-script text-base sm:text-lg md:text-xl text-earth leading-none">
            @{passport.username}
          </p>

          {showSignup ? (
            <div className="pt-1 space-y-1.5">
              <Link
                to="/auth?mode=signup"
                className="inline-flex items-center justify-center rounded-xl bg-earth text-cream px-5 py-2.5 text-sm font-medium shadow-sm hover:brightness-110 min-h-10"
              >
                Criar meu passaporte
              </Link>
              <p className="text-[10px] sm:text-[11px] text-earth/80 max-w-[16rem] hidden sm:block leading-snug">
                Crie sua conta para guardar mapas e viajar junto.
              </p>
            </div>
          ) : myPassportHref ? (
            <Link className="text-sm text-stamp hover:underline pt-1 w-fit" to={myPassportHref}>
              Ir para o meu passaporte →
            </Link>
          ) : null}
        </section>

        <section className="relative min-w-0 min-h-0 flex-1 flex items-center justify-center order-2 overflow-hidden">
          <div className="passport-stack relative w-full max-w-[40rem] mx-auto">
            {GHOST_PASSPORTS.map((g) => (
              <GhostPassport key={g.handle} {...g} />
            ))}
            <div className="passport-stack__top relative z-10">
              <div className="passport-stack__scale">
                <PassportCard passport={passport} variant="ticket" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
