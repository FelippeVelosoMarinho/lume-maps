import { Marker, Polyline, Tooltip } from 'react-leaflet'
import { segmentMidpoint, transportLabel, transportLegIcon } from '../lib/transport'

type PathPoint = {
  id: string
  lat: number
  lng: number
  title?: string
  transport?: string | null
}

type Props = {
  markers: PathPoint[]
  color: string
  pathKey: string
  weight?: number
  opacity?: number
  dashArray?: string
}

export function MapPathLegs({ markers, color, pathKey, weight = 2.5, opacity = 0.9, dashArray = '6, 8' }: Props) {
  if (markers.length < 2) return null

  const path = markers.map((m) => [m.lat, m.lng] as [number, number])

  return (
    <>
      <Polyline
        key={`path-${pathKey}`}
        positions={path}
        pathOptions={{
          color,
          weight,
          opacity,
          dashArray,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      {markers.slice(1).map((to, i) => {
        const from = markers[i]
        const icon = transportLegIcon(to.transport)
        if (!icon) return null
        const label = transportLabel(to.transport)
        return (
          <Marker
            key={`leg-${pathKey}-${to.id}`}
            position={segmentMidpoint(from, to)}
            icon={icon}
            interactive
          >
            <Tooltip>
              <span>
                {from.title || 'Origem'} → {to.title || 'Destino'}
                {label ? ` · ${label}` : ''}
              </span>
            </Tooltip>
          </Marker>
        )
      })}
    </>
  )
}
