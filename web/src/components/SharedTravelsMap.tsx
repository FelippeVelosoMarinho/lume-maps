import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap, Tooltip, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import { Maximize2, Minimize2 } from 'lucide-react'
import type { TravelJourney } from '../lib/api'
import { PLANNING_MAP_OPACITY, readShowPlanningMaps, writeShowPlanningMaps } from '../lib/planningMaps'
import { MapPathLegs } from './MapPathLegs'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

function cityKey(title: string, lat: number, lng: number) {
  const t = title.trim().toLowerCase()
  if (t) return t
  return `${lat.toFixed(3)},${lng.toFixed(3)}`
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function journeyNodeIcon(
  title: string,
  color: string | null,
  photoUrl?: string | null,
  opacity = 1,
) {
  const safe = escapeHtml(title).slice(0, 28)
  const hasPhoto = !!photoUrl
  const border = hasPhoto ? 'rgba(26, 21, 16, 0.35)' : color || '#2F6F73'
  const photoStyle = hasPhoto
    ? `background-image:url('${String(photoUrl).replace(/'/g, '%27')}');`
    : `background:${color || '#2F6F73'};`
  const wrapStyle = opacity < 1 ? `opacity:${opacity};` : ''
  return L.divIcon({
    className: '',
    iconSize: [112, 56],
    iconAnchor: [56, 28],
    html: `<div class="stamp-marker-wrap" style="${wrapStyle}">
      <div class="stamp-marker-icon ${hasPhoto ? 'has-photo' : ''}" style="border-color:${border};${photoStyle}"></div>
      <div class="stamp-marker-label">${safe}</div>
    </div>`,
  })
}

export type TravelerLayer = {
  username: string
  display_name: string
  color: string
  journeys: TravelJourney[]
}

function FitAll({ layers }: { layers: TravelerLayer[] }) {
  const map = useMap()
  useEffect(() => {
    const pts = layers.flatMap((t) =>
      t.journeys.flatMap((j) => j.markers.map((m) => [m.lat, m.lng] as [number, number])),
    )
    if (!pts.length) return
    map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 11 })
  }, [layers, map])
  return null
}

function MapResize({ expanded }: { expanded: boolean }) {
  const map = useMap()
  useEffect(() => {
    const id = window.setTimeout(() => {
      map.invalidateSize({ animate: false })
    }, 60)
    return () => window.clearTimeout(id)
  }, [expanded, map])
  return null
}

type CityPin = {
  key: string
  title: string
  lat: number
  lng: number
  photoUrl: string | null
  color: string | null
  travelerNames: string[]
  isPlanning: boolean
}

type Props = {
  layers: TravelerLayer[]
  className?: string
  /** Abre já expandido (útil na página dedicada) */
  defaultExpanded?: boolean
}

export function SharedTravelsMap({ layers, className, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [showPlanning, setShowPlanning] = useState(readShowPlanningMaps)

  const allJourneys = useMemo(() => layers.flatMap((t) => t.journeys), [layers])
  const hasPlanning = useMemo(() => allJourneys.some((j) => j.is_planning), [allJourneys])

  const filteredLayers = useMemo(
    () =>
      layers
        .map((t) => ({
          ...t,
          journeys: showPlanning ? t.journeys : t.journeys.filter((j) => !j.is_planning),
        }))
        .filter((t) => t.journeys.length > 0),
    [layers, showPlanning],
  )

  const withPath = useMemo(
    () =>
      filteredLayers
        .map((t) => ({
          ...t,
          journeys: t.journeys
            .map((j) => ({
              ...j,
              markers: [...j.markers].sort((a, b) => a.sort_order - b.sort_order),
            }))
            .filter((j) => j.markers.length > 0),
        }))
        .filter((t) => t.journeys.length > 0),
    [filteredLayers],
  )

  const cityPins = useMemo(() => {
    type Acc = {
      title: string
      lat: number
      lng: number
      photos: string[]
      colors: string[]
      travelerNames: string[]
      isPlanning: boolean
    }
    const byCity = new Map<string, Acc>()

    for (const t of withPath) {
      for (const j of t.journeys) {
        for (const m of j.markers) {
          const key = cityKey(m.title, m.lat, m.lng)
          let acc = byCity.get(key)
          if (!acc) {
            acc = {
              title: m.title,
              lat: m.lat,
              lng: m.lng,
              photos: [],
              colors: [],
              travelerNames: [],
              isPlanning: !!j.is_planning,
            }
            byCity.set(key, acc)
          }
          if (m.primary_photo_url && !acc.photos.includes(m.primary_photo_url)) {
            acc.photos.push(m.primary_photo_url)
          }
          if (t.color && !acc.colors.includes(t.color)) {
            acc.colors.push(t.color)
          }
          const name = t.display_name || t.username
          if (name && !acc.travelerNames.includes(name)) {
            acc.travelerNames.push(name)
          }
          if (j.is_planning) acc.isPlanning = true
        }
      }
    }

    const pins: CityPin[] = []
    for (const [key, acc] of byCity) {
      const hasPhoto = acc.photos.length > 0
      pins.push({
        key,
        title: acc.title,
        lat: acc.lat,
        lng: acc.lng,
        photoUrl: hasPhoto ? pickRandom(acc.photos) : null,
        color: hasPhoto ? null : pickRandom(acc.colors),
        travelerNames: acc.travelerNames,
        isPlanning: acc.isPlanning,
      })
    }
    return pins
  }, [withPath])

  function togglePlanning(show: boolean) {
    setShowPlanning(show)
    writeShowPlanningMaps(show)
  }

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [expanded])

  const hasAnyMarkers = allJourneys.some((j) => j.markers.length > 0)

  if (!hasAnyMarkers) {
    return (
      <p className="text-sm text-earth py-6 text-center">
        Ainda não há trajetos públicos para mostrar. Adicione viajantes com mapas.
      </p>
    )
  }

  if (!withPath.length) {
    return (
      <div className="space-y-3">
        {hasPlanning && (
          <label className="inline-flex items-center gap-2 text-xs text-earth cursor-pointer">
            <input
              type="checkbox"
              checked={showPlanning}
              onChange={(e) => togglePlanning(e.target.checked)}
              className="rounded border-ink/30"
            />
            Mostrar mapas de planejamento
          </label>
        )}
        <p className="text-sm text-earth py-6 text-center">
          Nenhum trajeto visível. Ative os mapas de planejamento para vê-los.
        </p>
      </div>
    )
  }

  const first = withPath[0].journeys[0].markers[0]
  const center: [number, number] = [first.lat, first.lng]

  const mapFrame = (
    <div
      className={
        expanded
          ? 'fixed inset-0 z-[2000] bg-ink/40 flex flex-col p-3 sm:p-5'
          : 'relative'
      }
    >
      <div
        className={
          expanded
            ? 'relative flex-1 min-h-0 rounded-sm overflow-hidden border border-ink/20 bg-paper shadow-lg'
            : 'relative h-[min(62dvh,480px)] sm:h-[480px] md:h-[560px] rounded-sm overflow-hidden border border-ink/20'
        }
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="absolute top-2.5 right-2.5 z-[1000] inline-flex items-center gap-1.5 rounded-md border border-ink/25 bg-cream/95 px-2.5 py-2 text-xs font-medium text-ink shadow-sm hover:bg-paper min-h-10"
          aria-label={expanded ? 'Recolher mapa' : 'Expandir mapa'}
          title={expanded ? 'Recolher' : 'Expandir'}
        >
          {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          <span className="hidden sm:inline">{expanded ? 'Recolher' : 'Expandir'}</span>
        </button>

        <MapContainer
          center={center}
          zoom={5}
          className="h-full w-full warm-map"
          scrollWheelZoom
          zoomControl={false}
        >
          <TileLayer
            attribution="&copy; OSM &copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <ZoomControl position="bottomright" />
          <FitAll layers={withPath} />
          <MapResize expanded={expanded} />
          {withPath.map((t) =>
            t.journeys.map((j) => (
              <MapPathLegs
                key={`path-${t.username}-${j.id}`}
                pathKey={`${t.username}-${j.id}`}
                markers={j.markers}
                color={t.color}
                weight={j.is_planning ? 2 : 3}
                opacity={j.is_planning ? PLANNING_MAP_OPACITY : 0.9}
                dashArray={j.is_planning ? '4, 10' : '6, 8'}
              />
            )),
          )}
          {cityPins.map((pin) => (
            <Marker
              key={pin.key}
              position={[pin.lat, pin.lng]}
              icon={journeyNodeIcon(
                pin.title,
                pin.color,
                pin.photoUrl,
                pin.isPlanning ? PLANNING_MAP_OPACITY : 1,
              )}
            >
              <Tooltip>
                <span className="font-medium">{pin.title}</span>
                {pin.isPlanning && (
                  <>
                    <br />
                    <span className="text-xs opacity-80">Planejamento</span>
                  </>
                )}
                {pin.travelerNames.map((name) => (
                  <span key={name}>
                    <br />
                    <span className="text-xs opacity-80">{name}</span>
                  </span>
                ))}
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )

  return (
    <div className={className ?? 'space-y-3'}>
      {hasPlanning && (
        <label className="inline-flex items-center gap-2 text-xs text-earth cursor-pointer">
          <input
            type="checkbox"
            checked={showPlanning}
            onChange={(e) => togglePlanning(e.target.checked)}
            className="rounded border-ink/30"
          />
          Mostrar mapas de planejamento
        </label>
      )}
      {mapFrame}
      {expanded && (
        <div
          className="h-[min(62dvh,480px)] sm:h-[480px] md:h-[560px] rounded-sm border border-dashed border-ink/15 bg-sand/20"
          aria-hidden
        />
      )}

      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {layers.map((t) => (
          <li key={t.username} className="flex items-center gap-2">
            <span
              className="inline-block w-3.5 h-1 rounded-full shrink-0"
              style={{ background: t.color }}
              aria-hidden
            />
            <span className="text-ink font-medium">{t.display_name || t.username}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
