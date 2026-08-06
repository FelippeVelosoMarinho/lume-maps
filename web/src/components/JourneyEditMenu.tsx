import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Music2, Settings2, Trash2, UserPlus, X } from 'lucide-react'
import {
  api,
  JOURNEY_COLOR_PALETTE,
  type Companion,
  type Journey,
  type PassportSearchHit,
} from '../lib/api'
import { AnalogPhoto } from './AnalogPhoto'

type Props = {
  open: boolean
  onClose: () => void
  journey: Journey
  slug: string
  isOwner: boolean
  onChanged: (j?: Journey) => void | Promise<void>
  onSelectPlace: (id: string) => void
  onDeleted?: () => void
}

export function JourneyEditMenu({
  open,
  onClose,
  journey,
  slug,
  isOwner,
  onChanged,
  onSelectPlace,
  onDeleted,
}: Props) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(journey.title)
  const [startedOn, setStartedOn] = useState(journey.started_on ?? '')
  const [endedOn, setEndedOn] = useState(journey.ended_on ?? '')
  const [playlist, setPlaylist] = useState(journey.playlist_url ?? '')
  const [color, setColor] = useState(journey.color || JOURNEY_COLOR_PALETTE[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [hits, setHits] = useState<PassportSearchHit[]>([])
  const [companions, setCompanions] = useState<Companion[]>(journey.companions ?? [])

  useEffect(() => {
    setTitle(journey.title)
    setStartedOn(journey.started_on ?? '')
    setEndedOn(journey.ended_on ?? '')
    setPlaylist(journey.playlist_url ?? '')
    setColor(journey.color || JOURNEY_COLOR_PALETTE[0])
    setCompanions(journey.companions ?? [])
  }, [journey])

  useEffect(() => {
    if (!isOwner || searchQ.trim().length < 2) {
      setHits([])
      return
    }
    const t = setTimeout(() => {
      void api
        .searchPassports(searchQ.trim())
        .then(setHits)
        .catch(() => setHits([]))
    }, 300)
    return () => clearTimeout(t)
  }, [searchQ, isOwner])

  const photos = useMemo(() => {
    const list: { url: string; title: string; markerId: string }[] = []
    for (const m of [...journey.markers].sort((a, b) => a.sort_order - b.sort_order)) {
      for (const a of m.attachments.filter((x) => x.kind === 'photo')) {
        list.push({ url: a.url, title: m.title, markerId: m.id })
      }
    }
    return list.slice(0, 12)
  }, [journey.markers])

  const places = useMemo(
    () => [...journey.markers].sort((a, b) => a.sort_order - b.sort_order),
    [journey.markers],
  )

  async function saveMeta() {
    if (startedOn && endedOn && endedOn < startedOn) {
      setError('A data final deve ser igual ou depois da data inicial.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const updated = await api.updateJourney(slug, {
        title: title.trim() || journey.title,
        started_on: startedOn || null,
        ended_on: endedOn || null,
        playlist_url: playlist.trim() || null,
        color,
      })
      await onChanged(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setBusy(false)
    }
  }

  async function addPerson(username: string) {
    setBusy(true)
    setError('')
    try {
      const list = await api.addCompanion(slug, username)
      setCompanions(list)
      setSearchQ('')
      setHits([])
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível adicionar')
    } finally {
      setBusy(false)
    }
  }

  async function removePerson(username: string) {
    if (!confirm(`Remover @${username} deste mapa?`)) return
    setBusy(true)
    setError('')
    try {
      await api.removeCompanion(slug, username)
      setCompanions((c) => c.filter((x) => x.username !== username))
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível remover')
    } finally {
      setBusy(false)
    }
  }

  async function deleteMap() {
    if (
      !confirm(
        `Apagar o mapa “${journey.title}”? Isso remove lugares, fotos e carimbos ligados a ele. Não dá para desfazer.`,
      )
    ) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.deleteJourney(slug)
      onDeleted?.()
      const dest = journey.owner_username ? `/p/${journey.owner_username}` : '/'
      navigate(dest)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível apagar')
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="map-ui-overlay !pointer-events-none">
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 md:inset-y-3 md:right-3 md:left-auto md:bottom-3 md:w-[400px] max-h-[85vh] md:max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-t-2xl md:rounded-sm border border-ink/25 bg-paper shadow-2xl paper-grain doc-frame">
        <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-b border-dashed border-ink/20 px-4 py-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-earth">Menu do mapa</p>
            <h2 className="font-display text-lg leading-tight">Editar viagem</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-sand" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {error && <p className="text-xs text-red-800">{error}</p>}

          <section className="space-y-2">
            <label className="block text-sm">
              <span className="text-[11px] uppercase text-earth">Nome</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full border border-dashed border-ink/30 bg-cream px-3 py-2 text-sm outline-none focus:border-earth"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="text-[11px] uppercase text-earth">Início</span>
                <input
                  type="date"
                  value={startedOn}
                  onChange={(e) => setStartedOn(e.target.value)}
                  className="mt-1 w-full border border-dashed border-ink/30 bg-cream px-2 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-[11px] uppercase text-earth">Fim</span>
                <input
                  type="date"
                  value={endedOn}
                  onChange={(e) => setEndedOn(e.target.value)}
                  className="mt-1 w-full border border-dashed border-ink/30 bg-cream px-2 py-2 text-sm"
                />
              </label>
            </div>
          </section>

          <section>
            <p className="text-[11px] uppercase text-earth mb-2">Cor do mapa</p>
            <div className="flex flex-wrap gap-2">
              {JOURNEY_COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    color === c ? 'border-ink scale-110' : 'border-transparent'
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </section>

          <section>
            <label className="block text-sm">
              <span className="text-[11px] uppercase text-earth flex items-center gap-1">
                <Music2 size={12} /> Playlist
              </span>
              <input
                value={playlist}
                onChange={(e) => setPlaylist(e.target.value)}
                placeholder="https://open.spotify.com/…"
                className="mt-1 w-full border border-dashed border-ink/30 bg-cream px-3 py-2 text-sm outline-none focus:border-earth"
              />
            </label>
            {playlist.trim() && (
              <a
                href={playlist.trim()}
                target="_blank"
                rel="noreferrer"
                className="chip mt-2 inline-flex text-xs"
              >
                Abrir playlist
              </a>
            )}
          </section>

          <button
            type="button"
            disabled={busy}
            onClick={() => void saveMeta()}
            className="w-full rounded-xl bg-earth text-cream py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {busy ? 'Salvando…' : 'Salvar alterações'}
          </button>

          <section>
            <p className="text-[11px] uppercase text-earth mb-2">Fotos da viagem</p>
            {photos.length === 0 ? (
              <p className="text-sm text-earth/70">Nenhuma foto ainda — adicione nos lugares.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((p, i) => (
                  <button
                    key={`${p.markerId}-${i}`}
                    type="button"
                    className="shrink-0"
                    onClick={() => {
                      onSelectPlace(p.markerId)
                      onClose()
                    }}
                  >
                    <AnalogPhoto src={p.url} thumb imgClassName="h-16 w-16" className="!rotate-0" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <p className="text-[11px] uppercase text-earth mb-2">Lugares</p>
            <ul className="space-y-1.5">
              {places.map((m, i) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 text-left border border-ink/10 bg-cream/70 px-2 py-2 text-sm hover:bg-sand/40"
                    onClick={() => {
                      onSelectPlace(m.id)
                      onClose()
                    }}
                  >
                    <span className="font-mono text-xs w-5" style={{ color }}>
                      {i + 1}
                    </span>
                    <span className="truncate flex-1">{m.title}</span>
                    <span className="text-[10px] text-earth">editar</span>
                  </button>
                </li>
              ))}
              {places.length === 0 && (
                <p className="text-sm text-earth/70">Nenhum lugar. Use o carimbo para adicionar.</p>
              )}
            </ul>
          </section>

          <section>
            <p className="text-[11px] uppercase text-earth mb-2 flex items-center gap-1">
              <UserPlus size={12} /> Pessoas no mapa
            </p>
            <ul className="space-y-2 mb-3">
              {companions.map((c) => (
                <li
                  key={c.user_id}
                  className="flex items-center gap-2 border border-ink/10 bg-cream/70 px-2 py-1.5 text-sm"
                >
                  {c.photo_url ? (
                    <img src={c.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-sand flex items-center justify-center text-xs text-earth">
                      {c.display_name.slice(0, 1)}
                    </span>
                  )}
                  <Link to={`/p/${c.username}`} className="flex-1 min-w-0 hover:underline">
                    <span className="block truncate font-medium">{c.display_name}</span>
                    <span className="block text-[10px] text-earth">@{c.username}</span>
                  </Link>
                  {isOwner && (
                    <button
                      type="button"
                      className="p-1.5 text-earth/60 hover:text-earth"
                      onClick={() => void removePerson(c.username)}
                      aria-label={`Remover ${c.username}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
              {companions.length === 0 && (
                <p className="text-sm text-earth/70">Só você por enquanto.</p>
              )}
            </ul>

            {isOwner && (
              <div>
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Buscar por @usuário ou nome…"
                  className="w-full border border-dashed border-ink/30 bg-cream px-3 py-2 text-sm outline-none focus:border-earth"
                />
                {hits.length > 0 && (
                  <ul className="mt-1 border border-ink/15 bg-cream max-h-40 overflow-auto text-sm">
                    {hits.map((h) => (
                      <li key={h.username}>
                        <button
                          type="button"
                          disabled={busy || companions.some((c) => c.username === h.username)}
                          className="w-full text-left px-3 py-2 hover:bg-sand/50 disabled:opacity-40 border-b border-ink/5"
                          onClick={() => void addPerson(h.username)}
                        >
                          <span className="font-medium">{h.display_name}</span>
                          <span className="text-earth text-xs ml-2">@{h.username}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[10px] text-earth/60 mt-1">
                  Só quem já tem passaporte pode ser adicionado.
                </p>
              </div>
            )}
          </section>

          {isOwner && (
            <section className="pt-2 border-t border-dashed border-ink/20">
              <button
                type="button"
                disabled={busy}
                onClick={() => void deleteMap()}
                className="w-full rounded-xl border border-red-900/40 bg-red-50 text-red-900 py-2.5 text-sm font-medium hover:bg-red-100 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                Apagar mapa
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

export function JourneyMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="chip inline-flex items-center gap-1.5">
      <Settings2 size={14} />
      Menu
    </button>
  )
}
