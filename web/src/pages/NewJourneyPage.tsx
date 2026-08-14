import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { Shell } from '../components/Shell'

type MapKind = 'memory' | 'planning'

export function NewJourneyPage() {
  const { me, loading } = useAuth()
  const nav = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState<MapKind>('memory')

  if (!loading && !me) return <Navigate to="/auth" replace />

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const isPlanning = kind === 'planning'
    const started = String(fd.get('started_on') || '') || null
    const ended = String(fd.get('ended_on') || '') || null
    if (started && ended && ended < started) {
      setError('A data final deve ser igual ou depois da data inicial.')
      setBusy(false)
      return
    }
    try {
      const j = await api.createJourney({
        title: String(fd.get('title')),
        subtitle: String(fd.get('subtitle') || ''),
        playlist_url: String(fd.get('playlist_url') || '') || undefined,
        started_on: started,
        ended_on: ended,
        is_planning: isPlanning,
      })
      nav(`/v/${j.slug}/edit`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="paper-grain doc-frame bg-paper p-6">
          <div className="star-border mb-4 opacity-60" />
          <h1 className="font-display text-2xl uppercase">Criar mapa</h1>
          <p className="text-sm text-earth mt-1">
            Recordação para viagens vividas; planejamento para rotas futuras — sem carimbos no passaporte.
          </p>
          <form className="mt-6 space-y-3" onSubmit={onSubmit}>
            <fieldset className="space-y-2">
              <legend className="text-[11px] uppercase text-earth">Tipo de mapa</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label
                  className={`flex flex-col gap-1 border border-dashed px-3 py-2.5 cursor-pointer ${
                    kind === 'memory' ? 'border-stamp bg-cream/80' : 'border-ink/20 bg-cream/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="map_kind"
                    value="memory"
                    checked={kind === 'memory'}
                    onChange={() => setKind('memory')}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">Recordação</span>
                  <span className="text-[10px] text-earth">Viagem realizada · gera carimbos</span>
                </label>
                <label
                  className={`flex flex-col gap-1 border border-dashed px-3 py-2.5 cursor-pointer ${
                    kind === 'planning' ? 'border-stamp bg-cream/80' : 'border-ink/20 bg-cream/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="map_kind"
                    value="planning"
                    checked={kind === 'planning'}
                    onChange={() => setKind('planning')}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">Planejamento</span>
                  <span className="text-[10px] text-earth">Rota futura · sem carimbos · datas opcionais</span>
                </label>
              </div>
            </fieldset>
            <label className="block text-sm">
              <span className="text-[11px] uppercase text-earth">Título</span>
              <input
                name="title"
                required
                placeholder={kind === 'planning' ? 'ex.: Roteiro Chile 2026' : 'ex.: Férias em Minas'}
                className="mt-1 w-full border border-dashed border-ink/30 bg-cream/70 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[11px] uppercase text-earth">Descrição</span>
              <input name="subtitle" className="mt-1 w-full border border-dashed border-ink/30 bg-cream/70 px-3 py-2" />
            </label>
            <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <legend className="text-[11px] uppercase text-earth col-span-full">
                {kind === 'planning' ? 'Período previsto (opcional)' : 'Período da viagem'}
              </legend>
              <label className="block text-sm">
                <span className="text-[10px] text-earth">Início</span>
                <input
                  name="started_on"
                  type="date"
                  className="mt-1 w-full border border-dashed border-ink/30 bg-cream/70 px-2 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-[10px] text-earth">Fim</span>
                <input
                  name="ended_on"
                  type="date"
                  className="mt-1 w-full border border-dashed border-ink/30 bg-cream/70 px-2 py-2"
                />
              </label>
            </fieldset>
            <label className="block text-sm">
              <span className="text-[11px] uppercase text-earth">Playlist (URL opcional)</span>
              <input name="playlist_url" className="mt-1 w-full border border-dashed border-ink/30 bg-cream/70 px-3 py-2" />
            </label>
            {error && <p className="text-sm text-red-800">{error}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-sky py-3 font-medium">
              Abrir mapa
            </button>
          </form>
          <div className="star-border mt-5 opacity-60" />
        </div>
      </div>
    </Shell>
  )
}
