import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { ArrowDown, ArrowUp, GripVertical, Search, Stamp, X } from 'lucide-react'
import { api, type Marker } from '../lib/api'

type NominatimAddress = {
  city?: string
  town?: string
  village?: string
  municipality?: string
  city_district?: string
  county?: string
  state?: string
  country?: string
}

type Hit = {
  display_name: string
  lat: string
  lon: string
  address?: NominatimAddress
}

type AddMode = 'visit' | 'departure' | 'return'

/** Extrai o nome da cidade a partir do resultado do Nominatim. */
export function cityFromHit(hit: Hit): string | null {
  const a = hit.address
  if (a) {
    const name =
      a.city || a.town || a.village || a.municipality || a.city_district || a.county
    if (name?.trim()) return name.trim()
    return null
  }
  const parts = hit.display_name.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) return parts[1]
  return parts[0] || null
}

function cityKey(name: string) {
  return name.trim().toLowerCase()
}

function sortMarkers(list: Marker[]) {
  return [...list].sort((a, b) => a.sort_order - b.sort_order)
}

function markerRoleLabel(m: Marker, ordered: Marker[]): string | null {
  if (m.is_departure) return 'partida'
  const key = (m.city || m.title || '').trim().toLowerCase()
  if (!key) return null
  const earlier = ordered.some(
    (x) => x.id !== m.id && x.sort_order < m.sort_order && (x.city || x.title || '').trim().toLowerCase() === key,
  )
  if (earlier) return 'retorno'
  if (m.has_stamp === false) return 'caminho'
  return null
}

type Props = {
  slug: string
  markers: Marker[]
  onChanged: () => void | Promise<void>
  onSelect: (id: string) => void
  onStamped?: (marker: Marker) => void
  /** Esconde FAB/painel quando outro sheet está aberto */
  hidden?: boolean
}

export function StampDock({ slug, markers, onChanged, onSelect, onStamped, hidden }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (hidden) setOpen(false)
  }, [hidden])
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [pendingHit, setPendingHit] = useState<Hit | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ordered, setOrdered] = useState<Marker[]>(() => sortMarkers(markers))
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const orderedRef = useRef(ordered)

  useEffect(() => {
    setOrdered(sortMarkers(markers))
  }, [markers])

  useEffect(() => {
    orderedRef.current = ordered
  }, [ordered])

  const citiesOnPath = useMemo(() => {
    const set = new Set<string>()
    for (const m of markers) {
      const key = (m.city || m.title || '').trim().toLowerCase()
      if (key) set.add(key)
    }
    return set
  }, [markers])

  useEffect(() => {
    if (q.trim().length < 3) {
      setHits([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const url =
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&q=${encodeURIComponent(q)}`
        const res = await fetch(url, { headers: { Accept: 'application/json' } })
        if (!res.ok) return
        setHits((await res.json()) as Hit[])
      } catch {
        /* ignore */
      }
    }, 400)
    return () => clearTimeout(t)
  }, [q])

  async function commitOrder(next: Marker[]) {
    const ids = next.map((m) => m.id)
    setOrdered(next.map((m, i) => ({ ...m, sort_order: i })))
    setBusy(true)
    setError('')
    try {
      await api.reorderMarkers(slug, ids)
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao ordenar')
      setOrdered(sortMarkers(markers))
    } finally {
      setBusy(false)
    }
  }

  async function addCity(hit: Hit, mode: AddMode) {
    const city = cityFromHit(hit)
    if (!city) {
      setError('Não foi possível identificar a cidade deste lugar.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const marker = await api.createMarker(slug, {
        lat: parseFloat(hit.lat),
        lng: parseFloat(hit.lon),
        title: city,
        city: cityKey(city),
        subtitle: hit.display_name,
        stamp: mode === 'visit',
        is_departure: mode === 'departure',
        sort_order: ordered.length,
      })
      setQ('')
      setHits([])
      setPendingHit(null)
      await onChanged()
      onStamped?.(marker)
      onSelect(marker.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível adicionar')
    } finally {
      setBusy(false)
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const nextIdx = index + dir
    if (nextIdx < 0 || nextIdx >= ordered.length) return
    const next = [...ordered]
    const tmp = next[index]
    next[index] = next[nextIdx]
    next[nextIdx] = tmp
    await commitOrder(next)
  }

  function onDragStart(index: number) {
    setDragIndex(index)
  }

  function onDragOver(e: DragEvent, index: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    setOrdered((prev) => {
      const next = [...prev]
      const [item] = next.splice(dragIndex, 1)
      next.splice(index, 0, item)
      orderedRef.current = next
      return next
    })
    setDragIndex(index)
  }

  async function onDragEnd() {
    setDragIndex(null)
    await commitOrder(orderedRef.current)
  }

  if (hidden) return null

  const pendingCity = pendingHit ? cityFromHit(pendingHit) : null
  const pendingOnPath = pendingCity ? citiesOnPath.has(cityKey(pendingCity)) : false

  return (
    <div className="map-ui-overlay pointer-events-none">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto absolute left-3 bottom-[max(1rem,env(safe-area-inset-bottom))] md:bottom-6 w-14 h-14 rounded-full bg-earth text-cream shadow-xl border-2 border-paper flex items-center justify-center hover:brightness-110"
        title={open ? 'Fechar' : 'Adicionar ao caminho'}
        aria-label={open ? 'Fechar menu de carimbo' : 'Adicionar ao caminho'}
        aria-expanded={open}
      >
        {open ? <X size={28} strokeWidth={2} /> : <Stamp size={26} strokeWidth={1.75} />}
      </button>

      {open && (
        <aside className="pointer-events-auto absolute left-3 right-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:right-auto md:bottom-24 w-auto md:w-[340px] max-w-[340px] max-h-[min(70dvh,28rem)] overflow-y-auto doc-frame bg-paper text-ink shadow-2xl paper-grain z-[1300]">
          <div className="sticky top-0 bg-paper/95 backdrop-blur border-b border-dashed border-ink/20 px-3 py-2.5 flex items-center justify-between">
            <p className="font-display text-sm uppercase flex items-center gap-2">
              <Stamp size={16} className="text-stamp" />
              Caminho
            </p>
            <button type="button" onClick={() => setOpen(false)} className="p-2 hover:bg-sand rounded-full" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          <div className="p-3 space-y-4">
            <div>
              <label className="text-[11px] uppercase text-earth">Buscar cidade ou lugar</label>
              <p className="text-[10px] text-earth/70 mt-0.5 mb-1">
                Visita carimba o passaporte. Partida e retorno entram só no trajeto.
              </p>
              <div className="mt-1 flex gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-earth/60" />
                  <input
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value)
                      setPendingHit(null)
                    }}
                    placeholder="ex.: Santa Luzia, MG"
                    className="w-full border border-dashed border-ink/30 bg-cream pl-8 pr-2 py-2 text-sm outline-none focus:border-stamp"
                  />
                </div>
              </div>

              {pendingHit && pendingCity && (
                <div className="mt-2 border border-ink/15 bg-cream p-2.5 space-y-2">
                  <p className="text-sm font-medium text-stamp">{pendingCity}</p>
                  <p className="text-[10px] text-earth/80 line-clamp-2">{pendingHit.display_name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {!pendingOnPath && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded-lg bg-stamp text-cream px-2.5 py-1.5 text-[11px] font-medium disabled:opacity-50"
                          onClick={() => void addCity(pendingHit, 'visit')}
                        >
                          Visita (carimbar)
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded-lg border border-ink/25 bg-paper px-2.5 py-1.5 text-[11px] font-medium disabled:opacity-50"
                          onClick={() => void addCity(pendingHit, 'departure')}
                        >
                          Só partida
                        </button>
                      </>
                    )}
                    {pendingOnPath && (
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-lg border border-ink/25 bg-paper px-2.5 py-1.5 text-[11px] font-medium disabled:opacity-50"
                        onClick={() => void addCity(pendingHit, 'return')}
                      >
                        Retorno ao caminho
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-[10px] text-earth underline"
                    onClick={() => setPendingHit(null)}
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {!pendingHit && hits.length > 0 && (
                <ul className="mt-2 border border-ink/15 bg-cream max-h-48 overflow-auto text-xs">
                  {hits.map((h) => {
                    const city = cityFromHit(h)
                    const onPath = city ? citiesOnPath.has(cityKey(city)) : false
                    return (
                      <li key={`${h.lat}-${h.lon}-${h.display_name}`}>
                        <button
                          type="button"
                          disabled={busy || !city}
                          className="w-full text-left px-2 py-2 hover:bg-sand/50 border-b border-ink/5 disabled:opacity-45 disabled:hover:bg-transparent"
                          onClick={() => {
                            setPendingHit(h)
                            setError('')
                          }}
                        >
                          <span className="font-medium text-stamp block">
                            {city || 'Cidade não identificada'}
                            {onPath ? ' · já no caminho' : ''}
                          </span>
                          <span className="text-earth/80 line-clamp-2">{h.display_name}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              {error && <p className="text-xs text-red-800 mt-2">{error}</p>}
            </div>

            <div>
              <p className="text-[11px] uppercase text-earth mb-2">Cidades no caminho</p>
              {ordered.length === 0 ? (
                <p className="text-sm text-earth/70">Nenhuma cidade ainda. Busque acima para adicionar.</p>
              ) : (
                <ul className="space-y-1.5">
                  {ordered.map((m, i) => {
                    const role = markerRoleLabel(m, ordered)
                    return (
                      <li
                        key={m.id}
                        draggable={!busy}
                        onDragStart={() => onDragStart(i)}
                        onDragOver={(e) => onDragOver(e, i)}
                        onDragEnd={() => void onDragEnd()}
                        className={`flex items-center gap-1 border border-ink/10 bg-cream/70 px-1.5 py-1.5 text-sm cursor-grab active:cursor-grabbing ${
                          dragIndex === i ? 'opacity-60 border-stamp' : ''
                        }`}
                      >
                        <span className="text-earth/50 shrink-0" aria-hidden>
                          <GripVertical size={14} />
                        </span>
                        <span className="font-mono text-xs text-stamp w-4 shrink-0">{i + 1}</span>
                        <button
                          type="button"
                          className="flex-1 text-left min-w-0"
                          onClick={() => {
                            onSelect(m.id)
                            setOpen(false)
                          }}
                        >
                          <span className="truncate block hover:text-stamp">{m.title}</span>
                          {role && (
                            <span className="text-[9px] uppercase tracking-wide text-earth/70">{role}</span>
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={busy || i === 0}
                          className="min-w-10 min-h-10 p-2 disabled:opacity-30 hover:bg-sand rounded text-earth inline-flex items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation()
                            void move(i, -1)
                          }}
                          aria-label="Subir no caminho"
                          title="Subir"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={busy || i === ordered.length - 1}
                          className="min-w-10 min-h-10 p-2 disabled:opacity-30 hover:bg-sand rounded text-earth inline-flex items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation()
                            void move(i, 1)
                          }}
                          aria-label="Descer no caminho"
                          title="Descer"
                        >
                          <ArrowDown size={16} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              <p className="text-[10px] text-earth/60 mt-2">
                Arraste ou use as setas para mudar a ordem da linha no mapa.
              </p>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
