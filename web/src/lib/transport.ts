import L from 'leaflet'

export const TRANSPORT_MODES = [
  { id: 'train', label: 'Trem', emoji: '🚂' },
  { id: 'car', label: 'Carro', emoji: '🚗' },
  { id: 'motorcycle', label: 'Moto', emoji: '🏍️' },
  { id: 'bicycle', label: 'Bicicleta', emoji: '🚲' },
  { id: 'walk', label: 'A pé', emoji: '🚶' },
  { id: 'plane', label: 'Avião', emoji: '✈️' },
  { id: 'ship', label: 'Navio', emoji: '🚢' },
] as const

export type TransportMode = (typeof TRANSPORT_MODES)[number]['id']

const BY_ID = Object.fromEntries(TRANSPORT_MODES.map((m) => [m.id, m])) as Record<
  TransportMode,
  (typeof TRANSPORT_MODES)[number]
>

export function isTransportMode(value: string | null | undefined): value is TransportMode {
  return !!value && value in BY_ID
}

export function transportLabel(value: string | null | undefined): string | null {
  if (!isTransportMode(value)) return null
  return BY_ID[value].label
}

export function transportEmoji(value: string | null | undefined): string | null {
  if (!isTransportMode(value)) return null
  return BY_ID[value].emoji
}

export function transportLegIcon(value: string | null | undefined) {
  const emoji = transportEmoji(value)
  const label = transportLabel(value) || 'Trecho'
  if (!emoji) return null
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div class="transport-leg-icon" title="${label}">${emoji}</div>`,
  })
}

export function segmentMidpoint(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): [number, number] {
  return [(a.lat + b.lat) / 2, (a.lng + b.lng) / 2]
}
