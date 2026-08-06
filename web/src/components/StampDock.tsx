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

type Props = {
  slug: string
  markers: Marker[]
  onChanged: () => void | Promise<void>
  onSelect: (id: string) => void
  onStamped?: (marker: Marker) => void
}

export function StampDock({ slug, markers, onChanged, onSelect, onStamped }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
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

  const stampedCities = useMemo(() => {
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

  async function stampCity(hit: Hit) {
    const city = cityFromHit(hit)
    if (!city) {
      setError('Não foi possível identificar a cidade deste lugar.')
      return
    }
    if (stampedCities.has(cityKey(city))) {
      setError(`Já existe um carimbo para ${city}. Só é permitido um por cidade.`)
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
        stamp: true,
        sort_order: ordered.length,
      })
      setQ('')
      setHits([])
      await onChanged()
      onStamped?.(marker)
      onSelect(marker.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carimbar')
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

  return (
    <div className="map-ui-overlay pointer-events-none">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto absolute left-3 bottom-4 md:bottom-6 w-14 h-14 rounded-full bg-earth text-cream shadow-xl border-2 border-paper flex items-center justify-center hover:brightness-110"
        title={open ? 'Fechar' : 'Adicionar carimbo'}
        aria-label={open ? 'Fechar menu de carimbo' : 'Adicionar carimbo'}
        aria-expanded={open}
      >
        {open ? <X size={28} strokeWidth={2} /> : <Stamp size={26} strokeWidth={1.75} />}
      </button>

      {open && (
        <aside className="pointer-events-auto absolute left-3 bottom-20 md:bottom-24 w-[min(92vw,340px)] max-h-[70vh] overflow-y-auto doc-frame bg-paper text-ink shadow-2xl paper-grain z-[1300]">
          <div className="sticky top-0 bg-paper/95 backdrop-blur border-b border-dashed border-ink/20 px-3 py-2.5 flex items-center justify-between">
            <p className="font-display text-sm uppercase flex items-center gap-2">
              <Stamp size={16} className="text-stamp" />
              Carimbar cidade
            </p>
            <button type="button" onClick={() => setOpen(false)} className="p-1 hover:bg-sand rounded-full" aria-label="Fechar">
              <X size={16} />
            </button>
          </div>

          <div className="p-3 space-y-4">
            <div>
              <label className="text-[11px] uppercase text-earth">Buscar cidade ou lugar</label>
              <p className="text-[10px] text-earth/70 mt-0.5 mb-1">
                Um carimbo por cidade. O selo usa o nome da cidade.
              </p>
              <div className="mt-1 flex gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-earth/60" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="ex.: Barbacena, MG"
                    className="w-full border border-dashed border-ink/30 bg-cream pl-8 pr-2 py-2 text-sm outline-none focus:border-stamp"
                  />
                </div>
              </div>
              {hits.length > 0 && (
                <ul className="mt-2 border border-ink/15 bg-cream max-h-48 overflow-auto text-xs">
                  {hits.map((h) => {
                    const city = cityFromHit(h)
                    const already = city ? stampedCities.has(cityKey(city)) : false
                    return (
                      <li key={`${h.lat}-${h.lon}-${h.display_name}`}>
                        <button
                          type="button"
                          disabled={busy || !city || already}
                          className="w-full text-left px-2 py-2 hover:bg-sand/50 border-b border-ink/5 disabled:opacity-45 disabled:hover:bg-transparent"
                          onClick={() => void stampCity(h)}
                        >
                          <span className="font-medium text-stamp block">
                            {city || 'Cidade não identificada'}
                            {already ? ' · já carimbada' : ''}
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
                <p className="text-sm text-earth/70">Nenhuma cidade ainda. Busque acima para carimbar.</p>
              ) : (
                <ul className="space-y-1.5">
                  {ordered.map((m, i) => (
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
                        className="flex-1 text-left truncate hover:text-stamp min-w-0"
                        onClick={() => {
                          onSelect(m.id)
                          setOpen(false)
                        }}
                      >
                        {m.title}
                      </button>
                      <button
                        type="button"
                        disabled={busy || i === 0}
                        className="p-1.5 disabled:opacity-30 hover:bg-sand rounded text-earth"
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
                        className="p-1.5 disabled:opacity-30 hover:bg-sand rounded text-earth"
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
                  ))}
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
