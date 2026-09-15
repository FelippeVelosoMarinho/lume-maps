import { Marker } from 'react-leaflet'
import L from 'leaflet'
import type { Marker as MarkerType } from '../lib/api'
import { mediaUrl } from '../lib/api'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

function resolveAuthorPhoto(
  ann: MarkerType['annotations'][0],
  authorPhotos?: Record<string, string | null | undefined>,
): string | null {
  const stored = ann.author_photo_url ? mediaUrl(ann.author_photo_url) || ann.author_photo_url : null
  if (stored) return stored
  const username = (ann.author_username || '').trim()
  if (username && authorPhotos?.[username]) {
    const url = authorPhotos[username]
    return url ? mediaUrl(url) || url : null
  }
  return null
}

function authorInitial(name: string, username: string) {
  const src = (name || username || '?').trim()
  return escapeHtml(src.charAt(0).toUpperCase())
}

function bubbleIcon(
  body: string,
  author: string,
  when: string | null,
  avatarUrl: string | null,
  initial: string,
  offsetIndex: number,
) {
  const excerpt = escapeHtml(body.slice(0, 80) + (body.length > 80 ? '…' : ''))
  const who = escapeHtml(author || 'viajante')
  const date = when ? escapeHtml(when) : ''
  const avatarStyle = avatarUrl
    ? `background-image:url('${String(avatarUrl).replace(/'/g, "%27")}')`
    : ''
  const shift = offsetIndex * 16

  return L.divIcon({
    className: '',
    iconSize: [210, 92],
    iconAnchor: [130 - shift, 92],
    html: `<div class="map-comment-bubble-row" style="transform:translateX(${shift}px)">
      <div class="map-comment-bubble__avatar ${avatarUrl ? 'has-photo' : ''}" style="${avatarStyle}" aria-hidden="true">${avatarUrl ? '' : initial}</div>
      <div class="map-comment-bubble__column">
        <div class="map-comment-bubble__inner">
          <div class="map-comment-bubble__body">
            <p class="map-comment-bubble__text">“${excerpt}”</p>
            <p class="map-comment-bubble__meta">${who}${date ? ` · ${date}` : ''}</p>
          </div>
        </div>
        <div class="map-comment-bubble__tail"></div>
      </div>
    </div>`,
  })
}

type Props = {
  markers: MarkerType[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  /** Fotos de perfil por @username (dono + companheiros) */
  authorPhotos?: Record<string, string | null | undefined>
}

/** Balões de chat apontando para pins — só no mapa de viagem específica. */
export function MapCommentBubbles({ markers, selectedId, onSelect, authorPhotos }: Props) {
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
        const avatarUrl = resolveAuthorPhoto(ann, authorPhotos)
        const initial = authorInitial(ann.author_name || '', ann.author_username || '')

        const latOffset = 0.012 + annIndex * 0.004

        return (
          <Marker
            key={`${marker.id}-${ann.id}`}
            position={[marker.lat + latOffset, marker.lng]}
            icon={bubbleIcon(ann.body, who, when, avatarUrl, initial, annIndex)}
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
