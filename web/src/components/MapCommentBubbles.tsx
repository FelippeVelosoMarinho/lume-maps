import { useMemo, useState } from 'react'
import { Marker } from 'react-leaflet'
import L from 'leaflet'
import type { Marker as MarkerType } from '../lib/api'
import { mediaUrl } from '../lib/api'

type AnnType = 'note' | 'quote' | 'idea' | 'moment'

const ANN_META: Record<
  AnnType,
  { label: string; bg: string; border: string; accent: string; radius: string }
> = {
  note: {
    label: 'Nota',
    bg: '#fff8e1',
    border: '#e6b422',
    accent: '#9a7209',
    radius: '16px 16px 16px 4px',
  },
  quote: {
    label: 'Frase',
    bg: '#f4f0ff',
    border: '#7b61c7',
    accent: '#5a3ea1',
    radius: '4px 14px 14px 14px',
  },
  idea: {
    label: 'Ideia',
    bg: '#f3eeff',
    border: '#8338ec',
    accent: '#6a28c8',
    radius: '14px 14px 4px 14px',
  },
  moment: {
    label: 'Momento',
    bg: '#fff0eb',
    border: '#e63946',
    accent: '#b91c1c',
    radius: '14px 4px 14px 14px',
  },
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

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Deslocamento lateral do card quando há vários comentários na mesma cidade. */
function spreadDx(count: number, index: number): number {
  if (count <= 1) return 0
  const gap = 112
  return (index - (count - 1) / 2) * gap
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

/**
 * Ícone do Leaflet: a ponta da seta (centro inferior) = lat/lng da cidade.
 * O card fica acima; se houver vários no mesmo pin, desloca só o card.
 */
const ICON_W = 260
const ICON_H = 140
const TIP_X = ICON_W / 2
const TIP_Y = ICON_H - 1
const CARD_BOTTOM_Y = 86

function buildBubbleIcon(item: BubbleItem, highlighted: boolean, dimmed: boolean): L.DivIcon {
  const meta = ANN_META[item.annType]
  const dx = spreadDx(item.spreadCount, item.spreadIndex)
  const excerptRaw = item.body.slice(0, 100) + (item.body.length > 100 ? '…' : '')
  const excerpt =
    item.annType === 'quote' ? `«${escapeHtml(excerptRaw)}»` : escapeHtml(excerptRaw)
  const who = escapeHtml(item.who + (item.when ? ` · ${item.when}` : ''))
  const label = escapeHtml(meta.label)
  const initial = escapeHtml(item.initial)
  const avatar = item.avatarUrl
    ? `<span class="map-cb__avatar map-cb__avatar--photo" style="background-image:url('${String(item.avatarUrl).replace(/'/g, '%27')}')"></span>`
    : `<span class="map-cb__avatar">${initial}</span>`

  // Card deslocado; haste do centro inferior do card → ponta no pin da cidade
  const cardCenterX = TIP_X + dx
  const stem = `
    <svg class="map-cb__stem" width="${ICON_W}" height="${ICON_H}" viewBox="0 0 ${ICON_W} ${ICON_H}" aria-hidden="true">
      <line x1="${cardCenterX}" y1="${CARD_BOTTOM_Y}" x2="${TIP_X}" y2="${TIP_Y - 8}" stroke="${meta.border}" stroke-width="2.25" stroke-linecap="round"/>
      <polygon points="${TIP_X - 8},${TIP_Y - 11} ${TIP_X + 8},${TIP_Y - 11} ${TIP_X},${TIP_Y}" fill="${meta.border}"/>
    </svg>`

  const html = `
    <div class="map-cb map-cb--${item.annType}${highlighted ? ' is-on' : ''}${dimmed ? ' is-dim' : ''}" style="--cb-bg:${meta.bg};--cb-border:${meta.border};--cb-accent:${meta.accent};--cb-radius:${meta.radius};--cb-dx:${dx}px">
      ${stem}
      <div class="map-cb__card">
        ${avatar}
        <div class="map-cb__body">
          <span class="map-cb__type">${label}</span>
          <p class="map-cb__text">${excerpt}</p>
          <p class="map-cb__meta">${who}</p>
        </div>
      </div>
    </div>`

  return L.divIcon({
    className: 'map-cb-leaflet',
    iconSize: [ICON_W, ICON_H],
    // Ponta da seta no pin da cidade (levemente acima do centro do marker, no círculo)
    iconAnchor: [TIP_X, TIP_Y + 14],
    html,
  })
}

/** Balões ancorados no lat/lng da cidade (Marker Leaflet) — nunca no meio do caminho. */
export function MapCommentBubbles({ markers, selectedId, onSelect, authorPhotos }: Props) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const items = useMemo(() => {
    const out: BubbleItem[] = []
    for (const m of markers) {
      if (m.id === selectedId) continue
      const anns = (m.annotations ?? []).filter((a) => a.body?.trim())
      anns.forEach((ann, i) => {
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

  if (!items.length) return null

  const hasHover = hoveredKey !== null

  return (
    <>
      {items.map((item, z) => {
        const highlighted = hoveredKey === item.key
        const dimmed = hasHover && !highlighted
        const icon = buildBubbleIcon(item, highlighted, dimmed)

        return (
          <Marker
            key={`${item.key}-${highlighted ? 'on' : dimmed ? 'dim' : 'idle'}`}
            position={[item.lat, item.lng]}
            icon={icon}
            zIndexOffset={highlighted ? 1600 : 1100 + z}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e)
                onSelect?.(item.markerId)
              },
              mouseover: () => setHoveredKey(item.key),
              mouseout: () => setHoveredKey((k) => (k === item.key ? null : k)),
            }}
          />
        )
      })}
    </>
  )
}
