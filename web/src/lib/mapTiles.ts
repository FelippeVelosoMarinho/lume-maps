/** Tiles base CARTO Voyager — exige API key desde 2025/2026 (grátis até 5M/mês). */
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

export function cartoVoyagerTileUrl(): string {
  const key = import.meta.env.VITE_CARTO_API_KEY?.trim()
  const base = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
  if (!key) return base
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}key=${encodeURIComponent(key)}`
}

export { CARTO_ATTRIBUTION }
