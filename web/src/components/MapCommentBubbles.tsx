import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { Camera, Lightbulb, Quote, Sparkles, type LucideIcon } from 'lucide-react'
import type { Marker as MarkerType } from '../lib/api'
import { mediaUrl } from '../lib/api'

type AnnType = 'note' | 'quote' | 'idea' | 'moment'

const ANN_BUBBLE_STYLES: Record<
  AnnType,
  { label: string; Icon: LucideIcon; quoteWrap?: boolean }
> = {
  note: { label: 'Nota', Icon: Lightbulb },
  quote: { label: 'Frase', Icon: Quote, quoteWrap: true },
  idea: { label: 'Ideia', Icon: Sparkles },
  moment: { label: 'Momento', Icon: Camera },
}

function normalizeAnnType(type: string): AnnType {
  if (type === 'quote' || type === 'idea' || type === 'moment') return type
  return 'note'
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
  return src.charAt(0).toUpperCase()
}

/** Distribui balões num arco acima do pin, com espaçamento mínimo. */
function spreadOffset(count: number, index: number): { dx: number; dy: number } {
  const baseLift = 98
  const minGap = 76

  if (count <= 1) return { dx: 0, dy: -baseLift }

  const arcWidth = Math.max(minGap * (count - 1), minGap)
  const t = index / (count - 1)
  const dx = (t - 0.5) * arcWidth
  const dy = -baseLift - Math.abs(t - 0.5) * 28

  return { dx, dy }
}

type BubbleItem = {
  key: string
  markerId: string
  annType: AnnType
  body: string
  who: string
  when: string | null
  avatarUrl: string | null
  initial: string
  lat: number
  lng: number
  spreadIndex: number
  spreadCount: number
}

type Props = {
  markers: MarkerType[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  authorPhotos?: Record<string, string | null | undefined>
}

function CommentBubble({
  item,
  style,
  dimmed,
  highlighted,
  onSelect,
  onHover,
  onLeave,
}: {
  item: BubbleItem
  style: { left: number; top: number; zIndex: number }
  dimmed: boolean
  highlighted: boolean
  onSelect?: (id: string) => void
  onHover: () => void
  onLeave: () => void
}) {
  const styleDef = ANN_BUBBLE_STYLES[item.annType]
  const { Icon } = styleDef
  const excerpt = item.body.slice(0, 80) + (item.body.length > 80 ? '…' : '')

  return (
    <div
      className={`map-comment-bubble-row map-comment-bubble-row--overlay map-comment-bubble-row--${item.annType}${dimmed ? ' is-dimmed' : ''}${highlighted ? ' is-highlighted' : ''}`}
      style={style}
      role="button"
      tabIndex={0}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.(item.markerId)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect?.(item.markerId)
        }
      }}
    >
      <div
        className={`map-comment-bubble__avatar ${item.avatarUrl ? 'has-photo' : ''}`}
        style={item.avatarUrl ? { backgroundImage: `url('${item.avatarUrl}')` } : undefined}
        aria-hidden
      >
        {!item.avatarUrl && item.initial}
      </div>
      <div className="map-comment-bubble__column">
        <div className="map-comment-bubble__inner">
          <span className="map-comment-bubble__type">
            <Icon size={11} strokeWidth={2.25} aria-hidden />
            {styleDef.label}
          </span>
          <div className="map-comment-bubble__body">
            <p className="map-comment-bubble__text">
              {styleDef.quoteWrap ? `«${excerpt}»` : excerpt}
            </p>
            <p className="map-comment-bubble__meta">
              {item.who}
              {item.when ? ` · ${item.when}` : ''}
            </p>
          </div>
        </div>
        <div className="map-comment-bubble__tail" />
      </div>
    </div>
  )
}

/** Balões de chat apontando para pins — só no mapa de viagem específica. */
export function MapCommentBubbles({ markers, selectedId, onSelect, authorPhotos }: Props) {
  const map = useMap()
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [pane, setPane] = useState<HTMLElement | null>(null)

  const items = useMemo(() => {
    const out: BubbleItem[] = []
    for (const m of markers) {
      const anns = m.annotations.filter((a) => a.body?.trim())
      anns.forEach((ann, i) => {
        if (m.id === selectedId) return
        const when = ann.created_at
          ? new Date(ann.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
            })
          : null
        out.push({
          key: `${m.id}-${ann.id}`,
          markerId: m.id,
          annType: normalizeAnnType(ann.type),
          body: ann.body,
          who: ann.author_name || (ann.author_username ? `@${ann.author_username}` : 'viajante'),
          when,
          avatarUrl: resolveAuthorPhoto(ann, authorPhotos),
          initial: authorInitial(ann.author_name || '', ann.author_username || ''),
          lat: m.lat,
          lng: m.lng,
          spreadIndex: i,
          spreadCount: anns.length,
        })
      })
    }
    return out
  }, [markers, selectedId, authorPhotos])

  const updatePositions = useCallback(() => {
    const next: Record<string, { x: number; y: number }> = {}
    for (const item of items) {
      const pin = map.latLngToContainerPoint(L.latLng(item.lat, item.lng))
      const { dx, dy } = spreadOffset(item.spreadCount, item.spreadIndex)
      next[item.key] = { x: pin.x + dx, y: pin.y + dy }
    }
    setPositions(next)
  }, [map, items])

  useEffect(() => {
    let overlay = map.getPane('commentBubblesPane') as HTMLElement | undefined
    if (!overlay) {
      overlay = map.createPane('commentBubblesPane') as HTMLElement
      overlay.className = 'leaflet-comment-bubbles-pane'
    }
    setPane(overlay)
  }, [map])

  useEffect(() => {
    updatePositions()
    map.on('move zoom zoomend moveend resize viewreset', updatePositions)
    return () => {
      map.off('move zoom zoomend moveend resize viewreset', updatePositions)
    }
  }, [map, updatePositions])

  if (!items.length || !pane) return null

  const hasHover = hoveredKey !== null

  return createPortal(
    <div className="map-comment-bubbles-layer">
      {items.map((item, z) => {
        const pos = positions[item.key]
        if (!pos) return null

        const highlighted = hoveredKey === item.key
        const dimmed = hasHover && !highlighted

        return (
          <CommentBubble
            key={item.key}
            item={item}
            dimmed={dimmed}
            highlighted={highlighted}
            onSelect={onSelect}
            onHover={() => setHoveredKey(item.key)}
            onLeave={() => setHoveredKey((k) => (k === item.key ? null : k))}
            style={{
              left: pos.x,
              top: pos.y,
              zIndex: highlighted ? 2000 : 900 + z,
            }}
          />
        )
      })}
    </div>,
    pane,
  )
}
