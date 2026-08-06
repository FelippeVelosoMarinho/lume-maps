import { mediaUrl } from '../lib/api'

type Props = {
  src: string
  alt?: string
  caption?: string
  stampLabel?: string
  stampDate?: string
  className?: string
  imgClassName?: string
  thumb?: boolean
  onClick?: () => void
}

/** Foto impressa com filtro analógico automático + moldura + carimbo da expedição. */
export function AnalogPhoto({
  src,
  alt = '',
  caption,
  stampLabel,
  stampDate,
  className = '',
  imgClassName = 'h-36',
  thumb = false,
  onClick,
}: Props) {
  const url = mediaUrl(src)
  if (!url) return null

  return (
    <figure
      className={`analog-print ${thumb ? 'is-thumb' : ''} ${onClick ? 'is-clickable' : ''} ${className}`}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className={`analog-print__frame ${imgClassName}`}>
        <img src={url} alt={alt} className="analog-print__img" />
        <span className="analog-print__grain" aria-hidden />
        <span className="analog-print__glow" aria-hidden />
      </div>
      {caption && <figcaption className="analog-print__caption">{caption}</figcaption>}
      {stampLabel && (
        <div className="stamp-seal analog-print__stamp" aria-hidden>
          <span>
            {stampLabel.slice(0, 28)}
            {stampDate ? (
              <>
                <br />
                {stampDate}
              </>
            ) : null}
          </span>
        </div>
      )}
    </figure>
  )
}
