/** Formata período de viagem (início–fim). */
export function formatPeriod(start: string | null | undefined, end: string | null | undefined): string {
  if (!start && !end) return ''
  const fmt = (d: string) =>
    new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('pt-BR')
  if (start && end) {
    if (start === end) return fmt(start)
    return `${fmt(start)} – ${fmt(end)}`
  }
  if (start) return `a partir de ${fmt(start)}`
  return `até ${fmt(end!)}`
}
