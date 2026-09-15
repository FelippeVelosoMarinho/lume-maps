import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

type Props = {
  children: string
  className?: string
  /** Versão compacta (cards): sem margens grandes entre blocos */
  compact?: boolean
}

export function MarkdownText({ children, className = '', compact }: Props) {
  const text = children.trim()
  if (!text) return null

  return (
    <div
      className={`markdown-body text-sm text-earth leading-snug break-words ${
        compact ? 'markdown-body--compact' : ''
      } ${className}`}
    >
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, children: linkChildren }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-stamp underline underline-offset-2 hover:brightness-110"
              onClick={(e) => e.stopPropagation()}
            >
              {linkChildren}
            </a>
          ),
          p: ({ children: pChildren }) => <p className="mb-2 last:mb-0">{pChildren}</p>,
          strong: ({ children: s }) => <strong className="font-semibold text-ink/90">{s}</strong>,
          em: ({ children: e }) => <em className="italic">{e}</em>,
          ul: ({ children: u }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{u}</ul>,
          ol: ({ children: o }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{o}</ol>,
          li: ({ children: l }) => <li>{l}</li>,
          br: () => <br />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
