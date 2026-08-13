import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { Marker as MarkerType } from '../lib/api'
import { MapPathLegs } from './MapPathLegs'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

function routeNodeIcon(title: string, index: number, active: boolean, photoUrl?: string | null) {
  const safe = escapeHtml(title).slice(0, 28)
  const hasPhoto = !!photoUrl
  const photoStyle = hasPhoto
    ? `background-image:url('${String(photoUrl).replace(/'/g, "%27")}')`
    : ''
  const inner = hasPhoto ? '' : String(index + 1)
  return L.divIcon({
    className: '',
    iconSize: [112, 56],
    iconAnchor: [56, 28],
    html: `<div class="stamp-marker-wrap">
      <div class="stamp-marker-icon ${hasPhoto ? 'has-photo' : ''} ${active ? 'active' : ''}" style="${photoStyle}">${inner}</div>
      <div class="stamp-marker-label">${safe}</div>
    </div>`,
  })
}

function FitBounds({ markers, bottomPad = 0 }: { markers: MarkerType[]; bottomPad?: number }) {
  const map = useMap()
  useEffect(() => {
    if (!markers.length) return
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]))
    map.fitBounds(bounds, {
      paddingTopLeft: [40, 40],
      paddingBottomRight: [40, 40 + Math.max(0, Math.round(bottomPad * 0.45))],
      maxZoom: 12,
    })
  }, [markers, map]) // eslint-disable-line react-hooks/exhaustive-deps -- only re-fit when markers change

  useEffect(() => {
    map.invalidateSize({ animate: false })
  }, [bottomPad, map])

  return null
}

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick?.(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

type Props = {
  markers: MarkerType[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  onMapClick?: (lat: number, lng: number) => void
  className?: string
  flyTo?: { lat: number; lng: number } | null
  pathColor?: string
  /** Espaço inferior reservado para sheets (px) */
  bottomPad?: number
  /** Prévia estática (sem zoom/arraste) */
  preview?: boolean
}

export function WarmMap({
  markers,
  selectedId,
  onSelect,
  onMapClick,
  className,
  flyTo,
  pathColor,
  bottomPad = 0,
  preview = false,
}: Props) {
  const ordered = useMemo(
    () => [...markers].sort((a, b) => a.sort_order - b.sort_order),
    [markers],
  )

  const center = useMemo<[number, number]>(() => {
    if (ordered[0]) return [ordered[0].lat, ordered[0].lng]
    return [-21.5, -43.5]
  }, [ordered])

  const lineColor = pathColor || '#2F6F73'

  return (
    <div className={className ?? 'h-full w-full'}>
      <MapContainer
        center={center}
        zoom={8}
        className="h-full w-full warm-map"
        scrollWheelZoom={!preview}
        dragging={!preview}
        doubleClickZoom={!preview}
        zoomControl={!preview}
        attributionControl={!preview}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <MapPathLegs markers={ordered} color={lineColor} pathKey={`${lineColor}-${ordered.length}`} />
        <FitBounds markers={ordered} bottomPad={bottomPad} />
        {!preview && <FlyTo target={flyTo} />}
        {onMapClick && !preview && <ClickHandler onClick={onMapClick} />}
        {ordered.map((m, i) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={routeNodeIcon(
              m.title,
              i,
              m.id === selectedId,
              m.primary_photo_url || m.attachments?.find((a) => a.is_primary)?.url || m.attachments?.find((a) => a.kind === 'photo')?.url,
            )}
            eventHandlers={
              preview || !onSelect
                ? undefined
                : {
                    click: (e) => {
                      L.DomEvent.stopPropagation(e)
                      onSelect(m.id)
                    },
                  }
            }
          />
        ))}
      </MapContainer>
    </div>
  )
}

function FlyTo({ target }: { target?: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 12), { duration: 0.8 })
  }, [target, map])
  return null
}

/** @deprecated use WarmMap */
export const DarkMap = WarmMap
