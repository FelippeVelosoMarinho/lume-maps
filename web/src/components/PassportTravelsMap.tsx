import { useEffect, useMemo, Fragment } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { Link } from 'react-router-dom'
import type { TravelJourney } from '../lib/api'
import { formatPeriod } from '../lib/dates'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

/** Mesmo visual dos carimbos do mapa de viagem. */
function journeyNodeIcon(title: string, color: string, photoUrl?: string | null) {
  const safe = escapeHtml(title).slice(0, 28)
  const hasPhoto = !!photoUrl
  const photoStyle = hasPhoto
    ? `background-image:url('${String(photoUrl).replace(/'/g, '%27')}');`
    : `background:${color};`
  return L.divIcon({
    className: '',
    iconSize: [112, 56],
    iconAnchor: [56, 28],
    html: `<div class="stamp-marker-wrap">
      <div class="stamp-marker-icon ${hasPhoto ? 'has-photo' : ''}" style="border-color:${color};${photoStyle}"></div>
      <div class="stamp-marker-label" style="border-color:${color}">${safe}</div>
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

type Props = {
  journeys: TravelJourney[]
  className?: string
}

export function PassportTravelsMap({ journeys, className }: Props) {
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

  if (!withPath.length) {
    return (
      <p className="text-sm text-earth py-6 text-center">
        Ainda não há trajetos para mostrar no mapa.
      </p>
    )
  }

  const center: [number, number] = [withPath[0].markers[0].lat, withPath[0].markers[0].lng]

  return (
    <div className={className ?? 'space-y-3'}>
      <div className="h-[min(52dvh,360px)] sm:h-[360px] md:h-[440px] rounded-sm overflow-hidden border border-ink/20">
        <MapContainer center={center} zoom={5} className="h-full w-full warm-map" scrollWheelZoom={false}>
          <TileLayer
            attribution="&copy; OSM &copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <FitAll journeys={withPath} />
          {/* Polylines primeiro (embaixo), depois marcadores — mapas sobrepostos */}
          {withPath.map((j) => {
            const path = j.markers.map((m) => [m.lat, m.lng] as [number, number])
            if (path.length < 2) return null
            return (
              <Polyline
                key={`path-${j.id}`}
                positions={path}
                pathOptions={{
                  color: j.color,
                  weight: 3,
                  opacity: 0.88,
                  dashArray: '6, 8',
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            )
          })}
          {withPath.map((j) => (
            <Fragment key={`marks-${j.id}`}>
              {j.markers.map((m) => (
                <Marker
                  key={m.id}
                  position={[m.lat, m.lng]}
                  icon={journeyNodeIcon(m.title, j.color, m.primary_photo_url)}
                >
                  <Tooltip>
                    <span className="font-medium">{m.title}</span>
                    <br />
                    <span className="text-xs opacity-80">{j.title}</span>
                  </Tooltip>
                </Marker>
              ))}
            </Fragment>
          ))}
        </MapContainer>
      </div>

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
