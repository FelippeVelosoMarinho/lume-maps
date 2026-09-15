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

export const SUBTITLE_MAX_LENGTH = 4000
