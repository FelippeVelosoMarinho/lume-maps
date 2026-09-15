/** Remove marcação markdown leve para previews/meta/share. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/[*_~`>#|-]/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Converte URLs soltas em links markdown, sem alterar os já no formato [texto](url).
 */
export function autolinkMarkdown(md: string): string {
  const placeholders: string[] = []
  const withPlaceholders = md.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (match) => {
    const i = placeholders.length
    placeholders.push(match)
    return `\u0000MD${i}\u0000`
  })

  const linked = withPlaceholders.replace(
    /(?<![(\w])https?:\/\/[^\s<>[\]()]+/gi,
    (url) => {
      const clean = url.replace(/[.,;:!?)]+$/, '')
      const trailing = url.slice(clean.length)
      return `[${clean}](${clean})${trailing}`
    },
  )

  return linked.replace(/\u0000MD(\d+)\u0000/g, (_, i) => placeholders[Number(i)] ?? '')
}

export const SUBTITLE_MAX_LENGTH = 4000
