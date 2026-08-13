import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap, Tooltip, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import { Link } from 'react-router-dom'
import { Maximize2, Minimize2 } from 'lucide-react'
import type { TravelJourney } from '../lib/api'
import { formatPeriod } from '../lib/dates'
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

/** Marcador do mapa do perfil: foto limpa (sem tinta da viagem) ou bolinha colorida. */
function journeyNodeIcon(title: string, color: string | null, photoUrl?: string | null) {
  const safe = escapeHtml(title).slice(0, 28)
  const hasPhoto = !!photoUrl
  const border = hasPhoto ? 'rgba(26, 21, 16, 0.35)' : color || '#2F6F73'
  const photoStyle = hasPhoto
    ? `background-image:url('${String(photoUrl).replace(/'/g, '%27')}');`
    : `background:${color || '#2F6F73'};`
  return L.divIcon({
    className: '',
    iconSize: [112, 56],
    iconAnchor: [56, 28],
    html: `<div class="stamp-marker-wrap">
      <div class="stamp-marker-icon ${hasPhoto ? 'has-photo' : ''}" style="border-color:${border};${photoStyle}"></div>
      <div class="stamp-marker-label">${safe}</div>
    </div>`,
  })
}

function FitAll({ journeys }: { journeys: TravelJourney[] }) {
  const map = useMap()
  useEffect(() => {
    const pts = journeys.flatMap((j) => j.markers.map((m) => [m.lat, m.lng] as [number, number]))
    if (!pts.length) return
    map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 11 })
  }, [journeys, map])
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
  journeyTitles: string[]
}

type Props = {
  journeys: TravelJourney[]
  className?: string
}

export function PassportTravelsMap({ journeys, className }: Props) {
  const [expanded, setExpanded] = useState(false)

  const withPath = useMemo(
    () =>
      journeys
        .map((j) => ({
          ...j,
          markers: [...j.markers].sort((a, b) => a.sort_order - b.sort_order),
        }))
        .filter((j) => j.markers.length > 0),
    [journeys],
  )

  /** Um pin por cidade: se houver foto(s), escolhe uma ao acaso e não empilha a cor por cima. */
  const cityPins = useMemo(() => {
    type Acc = {
      title: string
      lat: number
      lng: number
      photos: string[]
      colors: string[]
      journeyTitles: string[]
    }
    const byCity = new Map<string, Acc>()

    for (const j of withPath) {
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
            journeyTitles: [],
          }
          byCity.set(key, acc)
        }
        if (m.primary_photo_url && !acc.photos.includes(m.primary_photo_url)) {
          acc.photos.push(m.primary_photo_url)
        }
        if (j.color && !acc.colors.includes(j.color)) {
          acc.colors.push(j.color)
        }
        if (j.title && !acc.journeyTitles.includes(j.title)) {
          acc.journeyTitles.push(j.title)
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
        journeyTitles: acc.journeyTitles,
      })
    }
    return pins
  }, [withPath])

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

  if (!withPath.length) {
    return (
      <p className="text-sm text-earth py-6 text-center">
        Ainda não há trajetos para mostrar no mapa.
      </p>
    )
  }

  const center: [number, number] = [withPath[0].markers[0].lat, withPath[0].markers[0].lng]

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
            : 'relative h-[min(52dvh,360px)] sm:h-[360px] md:h-[440px] rounded-sm overflow-hidden border border-ink/20'
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
          <FitAll journeys={withPath} />
          <MapResize expanded={expanded} />
          {withPath.map((j) => (
            <MapPathLegs
              key={`path-${j.id}`}
              pathKey={j.id}
              markers={j.markers}
              color={j.color}
              weight={3}
            />
          ))}
          {cityPins.map((pin) => (
            <Marker
              key={pin.key}
              position={[pin.lat, pin.lng]}
              icon={journeyNodeIcon(pin.title, pin.color, pin.photoUrl)}
            >
              <Tooltip>
                <span className="font-medium">{pin.title}</span>
                {pin.journeyTitles.map((t) => (
                  <span key={t}>
                    <br />
                    <span className="text-xs opacity-80">{t}</span>
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
      {mapFrame}
      {/* Placeholder de altura quando expandido, para não colapsar o layout por baixo */}
      {expanded && (
        <div
          className="h-[min(52dvh,360px)] sm:h-[360px] md:h-[440px] rounded-sm border border-dashed border-ink/15 bg-sand/20"
          aria-hidden
        />
      )}

      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {withPath.map((j) => (
          <li key={j.id} className="flex items-center gap-2">
            <span
              className="inline-block w-3.5 h-1 rounded-full shrink-0"
              style={{ background: j.color }}
              aria-hidden
            />
            <Link to={`/v/${j.slug}`} className="hover:underline text-ink font-medium">
              {j.title}
            </Link>
            {formatPeriod(j.started_on, j.ended_on) && (
              <span className="text-earth font-mono">{formatPeriod(j.started_on, j.ended_on)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
