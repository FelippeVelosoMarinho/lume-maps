import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { mediaUrl, type Companion } from '../lib/api'

type Props = {
  ownerUsername: string | null
  ownerDisplayName?: string | null
  companions: Companion[]
  period: string
}

/** Linha “@dono e outros · período” com popover de companheiros. */
export function JourneyPeopleLine({
  ownerUsername,
  companions,
  period,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const others = companions.filter((c) => c.username !== ownerUsername)
  const othersCount = others.length

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!ownerUsername) {
    return period ? <p className="text-[11px] text-earth truncate">{period}</p> : null
  }

  return (
    <div className="relative min-w-0" ref={ref}>
      <p className="text-[11px] text-earth flex flex-wrap items-center gap-x-1 gap-y-0.5">
        <Link className="text-stamp hover:underline shrink-0" to={`/p/${ownerUsername}`}>
          @{ownerUsername}
        </Link>
        {othersCount > 0 && (
          <>
            <span aria-hidden>e</span>
            <button
              type="button"
              className="inline-flex items-center gap-0.5 text-stamp hover:underline font-medium"
              aria-expanded={open}
              aria-haspopup="dialog"
              onClick={() => setOpen((v) => !v)}
            >
              {othersCount === 1 ? 'outro' : 'outros'}
              <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          </>
        )}
        {period && (
          <>
            <span className="text-earth/50" aria-hidden>
              ·
            </span>
            <span className="truncate">{period}</span>
          </>
        )}
      </p>

      {open && othersCount > 0 && (
        <div
          role="dialog"
          aria-label="Pessoas neste mapa"
          className="absolute left-0 top-full mt-1.5 z-40 min-w-[14rem] max-w-[18rem] doc-frame bg-paper shadow-lg py-2 text-sm"
        >
          <p className="px-3 pb-1.5 text-[10px] uppercase tracking-wider text-earth border-b border-dashed border-ink/15 mb-1">
            Neste mapa
          </p>
          <ul className="max-h-56 overflow-y-auto">
            <li>
              <Link
                to={`/p/${ownerUsername}`}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-sand/50"
                onClick={() => setOpen(false)}
              >
                <span className="font-medium text-stamp">@{ownerUsername}</span>
                <span className="text-[10px] uppercase text-earth/70">criou</span>
              </Link>
            </li>
            {others.map((c) => (
              <li key={c.user_id}>
                <Link
                  to={`/p/${c.username}`}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-sand/50"
                  onClick={() => setOpen(false)}
                >
                  {c.photo_url ? (
                    <img
                      src={mediaUrl(c.photo_url) || c.photo_url}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover border border-ink/15 shrink-0"
                    />
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-sand border border-ink/15 shrink-0 flex items-center justify-center text-[10px] text-earth">
                      {c.display_name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block font-medium truncate">{c.display_name}</span>
                    <span className="block text-[11px] text-stamp truncate">@{c.username}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
