import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Passport } from '../lib/api'

export type PrivacyFlags = {
  public_show_journeys: boolean
  public_show_travels_map: boolean
  public_show_planning: boolean
  public_show_stamps: boolean
}

type Props = {
  open: boolean
  onClose: () => void
  passport: Passport
  busy?: boolean
  onSave: (flags: PrivacyFlags) => void | Promise<void>
}

function flagsFromPassport(p: Passport): PrivacyFlags {
  return {
    public_show_journeys: p.public_show_journeys !== false,
    public_show_travels_map: p.public_show_travels_map !== false,
    public_show_planning: p.public_show_planning !== false,
    public_show_stamps: p.public_show_stamps !== false,
  }
}

export function PassportPrivacyModal({ open, onClose, passport, busy, onSave }: Props) {
  const [flags, setFlags] = useState<PrivacyFlags>(() => flagsFromPassport(passport))

  useEffect(() => {
    if (open) setFlags(flagsFromPassport(passport))
  }, [open, passport])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-md max-h-[min(90dvh,36rem)] overflow-y-auto rounded-t-2xl sm:rounded-sm border border-ink/25 bg-paper shadow-2xl paper-grain doc-frame pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-b border-dashed border-ink/20 px-4 py-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-earth">Perfil público</p>
            <h2 className="font-display text-lg leading-tight">Privacidade</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 min-w-10 min-h-10 rounded-full hover:bg-sand shrink-0 inline-flex items-center justify-center"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-xs text-earth/80 leading-relaxed">
            Controle o que visitantes (com ou sem conta) veem em{' '}
            <span className="font-mono text-[10px]">/p/{passport.username}</span>.
          </p>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={flags.public_show_journeys}
              onChange={(e) => setFlags((f) => ({ ...f, public_show_journeys: e.target.checked }))}
              className="mt-1 rounded border-ink/30"
            />
            <span>
              <span className="block text-sm font-medium">Permitir ver meus mapas</span>
              <span className="text-[10px] text-earth/70">Lista de viagens no perfil</span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={flags.public_show_travels_map}
              onChange={(e) =>
                setFlags((f) => ({ ...f, public_show_travels_map: e.target.checked }))
              }
              className="mt-1 rounded border-ink/30"
            />
            <span>
              <span className="block text-sm font-medium">Permitir ver o mapa completo</span>
              <span className="text-[10px] text-earth/70">Mapa agregado “Onde passou”</span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={flags.public_show_planning}
              onChange={(e) => setFlags((f) => ({ ...f, public_show_planning: e.target.checked }))}
              className="mt-1 rounded border-ink/30"
            />
            <span>
              <span className="block text-sm font-medium">Incluir mapas de planejamento</span>
              <span className="text-[10px] text-earth/70">Roteiros futuros na lista e no mapa</span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={flags.public_show_stamps}
              onChange={(e) => setFlags((f) => ({ ...f, public_show_stamps: e.target.checked }))}
              className="mt-1 rounded border-ink/30"
            />
            <span>
              <span className="block text-sm font-medium">Permitir ver meus carimbos</span>
              <span className="text-[10px] text-earth/70">Selos de lugares visitados</span>
            </span>
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={() => void onSave(flags)}
            className="w-full rounded-xl bg-earth text-cream py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {busy ? 'Salvando…' : 'Salvar privacidade'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** True se o visitante vê alguma seção além do card (ou se tudo aberto). */
export function hasPublicProfileContent(p: Passport): boolean {
  return (
    p.public_show_journeys !== false ||
    p.public_show_travels_map !== false ||
    p.public_show_stamps !== false
  )
}
