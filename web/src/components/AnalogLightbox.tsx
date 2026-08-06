import Lightbox from 'yet-another-react-lightbox'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/counter.css'
import { mediaUrl } from '../lib/api'

export type GallerySlide = {
  src: string
  caption?: string
}

type Props = {
  open: boolean
  index: number
  slides: GallerySlide[]
  stampLabel?: string
  stampDate?: string
  onClose: () => void
  onIndexChange?: (index: number) => void
}

/** Lightbox com filtro analógico expandido para navegar entre fotos. */
export function AnalogLightbox({
  open,
  index,
  slides,
  stampLabel,
  stampDate,
  onClose,
  onIndexChange,
}: Props) {
  const yarlSlides = slides.map((s) => ({
    src: mediaUrl(s.src) || s.src,
    description: s.caption,
  }))

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={yarlSlides}
      plugins={[Counter]}
      on={{
        view: ({ index: i }) => onIndexChange?.(i),
      }}
      controller={{ closeOnBackdropClick: true }}
      styles={{
        container: { backgroundColor: 'rgba(26, 21, 16, 0.92)' },
      }}
      render={{
        slide: ({ slide }) => (
          <div className="analog-lightbox-slide">
            <figure className="analog-print analog-print--lightbox">
              <div className="analog-print__frame analog-print__frame--lightbox">
                <img src={slide.src} alt="" className="analog-print__img" />
                <span className="analog-print__grain" aria-hidden />
                <span className="analog-print__glow" aria-hidden />
              </div>
              {stampLabel && (
                <div className="stamp-seal analog-print__stamp analog-print__stamp--lightbox" aria-hidden>
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
              {'description' in slide && slide.description ? (
                <figcaption className="analog-print__caption">{String(slide.description)}</figcaption>
              ) : null}
            </figure>
          </div>
        ),
      }}
    />
  )
}
