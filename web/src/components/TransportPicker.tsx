import { TRANSPORT_MODES, type TransportMode } from '../lib/transport'

type Props = {
  value: TransportMode | ''
  onChange: (value: TransportMode) => void
  disabled?: boolean
  compact?: boolean
}

export function TransportPicker({ value, onChange, disabled, compact }: Props) {
  return (
    <div className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-1.5'}`}>
      {TRANSPORT_MODES.map((m) => {
        const selected = value === m.id
        return (
          <button
            key={m.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(m.id)}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium disabled:opacity-50 ${
              selected
                ? 'border-stamp bg-stamp text-cream'
                : 'border-ink/20 bg-paper text-ink hover:bg-sand/50'
            }`}
            aria-pressed={selected}
            title={m.label}
          >
            <span aria-hidden>{m.emoji}</span>
            {!compact && <span>{m.label}</span>}
            {compact && <span className="sr-only">{m.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
