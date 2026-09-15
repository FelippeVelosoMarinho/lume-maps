import { Marker } from 'react-leaflet'
import L from 'leaflet'
import type { Marker as MarkerType } from '../lib/api'
import { mediaUrl } from '../lib/api'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

function primaryPhoto(m: MarkerType): string | null {
  const url =
    m.primary_photo_url ||
    m.attachments?.find((a) => a.is_primary && a.kind === 'photo')?.url ||
    m.attachments?.find((a) => a.kind === 'photo')?.url
  return url ? mediaUrl(url) || url : null
}

function bubbleIcon(
  body: string,
  author: string,
  when: string | null,
  photoUrl: string | null,
  offsetIndex: number,
) {
  const excerpt = escapeHtml(body.slice(0, 72) + (body.length > 72 ? '…' : ''))
  const who = escapeHtml(author || 'viajante')
  const date = when ? escapeHtml(when) : ''
  const photoStyle = photoUrl
    ? `background-image:url('${String(photoUrl).replace(/'/g, "%27")}')`
    : ''
  const shift = offsetIndex * 14

  return L.divIcon({
    className: '',
    iconSize: [168, 88],
    iconAnchor: [84 - shift, 88],
    html: `<div class="map-comment-bubble" style="transform:translateX(${shift}px)">
      <div class="map-comment-bubble__inner">
        ${photoUrl ? `<div class="map-comment-bubble__photo" style="${photoStyle}"></div>` : ''}
        <div class="map-comment-bubble__body">
          <p class="map-comment-bubble__text">“${excerpt}”</p>
          <p class="map-comment-bubble__meta">${who}${date ? ` · ${date}` : ''}</p>
        </div>
      </div>
      <div class="map-comment-bubble__tail"></div>
    </div>`,
  })
}

type Props = {
  markers: MarkerType[]
  selectedId?: string | null
  onSelect?: (id: string) => void
}

/** Balões de chat apontando para pins — só no mapa de viagem específica. */
export function MapCommentBubbles({ markers, selectedId, onSelect }: Props) {
  const items: { marker: MarkerType; annIndex: number; ann: MarkerType['annotations'][0] }[] = []

  for (const m of markers) {
    m.annotations.forEach((ann, i) => {
      if (!ann.body?.trim()) return
      items.push({ marker: m, annIndex: i, ann })
    })
  }

  if (!items.length) return null

  return (
    <>
      {items.map(({ marker, annIndex, ann }) => {
        if (marker.id === selectedId) return null

        const when = ann.created_at
          ? new Date(ann.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
            })
          : null
        const who =
          ann.author_name ||
          (ann.author_username ? `@${ann.author_username}` : '')

        // Desloca levemente ao norte para o balão flutuar acima do pin + rótulo
        const latOffset = 0.012 + annIndex * 0.004

        return (
          <Marker
            key={`${marker.id}-${ann.id}`}
            position={[marker.lat + latOffset, marker.lng]}
            icon={bubbleIcon(ann.body, who, when, primaryPhoto(marker), annIndex)}
            zIndexOffset={800 + annIndex}
            eventHandlers={
              onSelect
                ? {
                    click: (e) => {
                      L.DomEvent.stopPropagation(e)
                      onSelect(marker.id)
                    },
                  }
                : undefined
            }
          />
        )
      })}
    </>
  )
}
