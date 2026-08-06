import { useEffect, useState } from 'react'

type Hit = {
  display_name: string
  lat: string
  lon: string
}

type Props = {
  onPick: (lat: number, lng: number, label: string) => void
}

export function PlaceSearch({ onPick }: Props) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (q.trim().length < 3) {
      setHits([])
      return
    }
    const t = setTimeout(async () => {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return
      const data = (await res.json()) as Hit[]
      setHits(data)
      setOpen(true)
    }, 400)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar lugar…"
        className="w-44 md:w-56 rounded-xl border border-ink/20 bg-cream px-3 py-1.5 text-xs outline-none focus:border-sky"
      />
      {open && hits.length > 0 && (
        <ul className="absolute right-0 top-full mt-1 w-72 max-h-56 overflow-auto rounded-xl border border-ink/20 bg-paper shadow-lg z-50 text-xs">
          {hits.map((h) => (
            <li key={`${h.lat}-${h.lon}-${h.display_name}`}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-sand/50 border-b border-ink/5"
                onClick={() => {
                  onPick(parseFloat(h.lat), parseFloat(h.lon), h.display_name.split(',')[0])
                  setQ('')
                  setHits([])
                  setOpen(false)
                }}
              >
                {h.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
