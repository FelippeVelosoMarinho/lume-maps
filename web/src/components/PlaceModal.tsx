import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Lightbulb, MapPin, Quote, Sparkles, Stamp, X } from 'lucide-react'
import type { Journey, Marker } from '../lib/api'
import { formatPeriod } from '../lib/dates'
import { AnalogPhoto } from './AnalogPhoto'
import { AnalogLightbox } from './AnalogLightbox'

const TYPE_LABELS: Record<string, { label: string; Icon: typeof Lightbulb }> = {
  note: { label: 'Nota', Icon: Lightbulb },
  quote: { label: 'Frase', Icon: Quote },
  idea: { label: 'Ideia', Icon: Sparkles },
  moment: { label: 'Momento', Icon: Camera },
}

type Props = {
  marker: Marker
  journey: Journey
  onClose: () => void
}

/** Modal centrado para visitante ver cidade, viagem, fotos e comentários. */
export function PlaceModal({ marker, journey, onClose }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const photos = marker.attachments.filter((a) => a.kind === 'photo')
  const period = formatPeriod(journey.started_on, journey.ended_on)
  const expeditionDate = journey.started_on || journey.ended_on
  const stampDate = expeditionDate
    ? new Date(expeditionDate + (expeditionDate.length === 10 ? 'T12:00:00' : '')).toLocaleDateString(
        'pt-BR',
        { month: 'short', year: '2-digit' },
      )
    : undefined
  const owner = journey.owner_username

  function openLightbox(i: number) {
    setLightboxIndex(i)
    setLightboxOpen(true)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !lightboxOpen) onClose()
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose, lightboxOpen])

  return (
    <>
      <div
        className="fixed inset-0 z-[1400] flex items-end sm:items-center justify-center p-0 sm:p-4"
        role="presentation"
      >
        <button
          type="button"
          className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
          aria-label="Fechar"
          onClick={onClose}
        />
        <div
          className="relative w-full sm:max-w-lg max-h-[min(92dvh,40rem)] overflow-y-auto rounded-t-2xl sm:rounded-sm border border-ink/25 bg-paper shadow-2xl paper-grain doc-frame pb-[env(safe-area-inset-bottom)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="place-modal-title"
        >
          <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-b border-dashed border-ink/20 px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.14em] text-earth flex items-center gap-1">
                <MapPin size={12} /> Cidade
              </p>
              <h2 id="place-modal-title" className="font-display text-xl leading-snug break-words">
                {marker.title}
              </h2>
              {marker.subtitle && (
                <p className="text-sm text-earth mt-0.5 break-words">{marker.subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 min-w-10 min-h-10 rounded-full hover:bg-sand shrink-0 inline-flex items-center justify-center"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-4 space-y-5">
            {/* Viagem */}
            <section className="rounded-sm border border-ink/15 bg-sand/30 px-3 py-3">
              <p className="text-[10px] uppercase tracking-wider text-earth mb-1">Viagem</p>
              <div className="flex items-start gap-2">
                {journey.color && (
                  <span
                    className="w-3 h-3 rounded-full shrink-0 mt-1"
                    style={{ background: journey.color }}
                    aria-hidden
                  />
                )}
                <div className="min-w-0">
                  <p className="font-display text-base leading-snug">{journey.title}</p>
                  {period && <p className="font-mono text-xs text-earth mt-0.5">{period}</p>}
                  {owner && (
                    <p className="text-xs text-earth mt-1">
                      Mapa de{' '}
                      <Link to={`/p/${owner}`} className="text-stamp hover:underline">
                        @{owner}
                      </Link>
                    </p>
                  )}
                  {journey.is_planning && (
                    <span className="inline-block mt-1.5 text-[9px] uppercase tracking-wide bg-earth/10 text-earth px-2 py-0.5 rounded-full">
                      Planejamento
                    </span>
                  )}
                </div>
              </div>
              {marker.has_stamp && (
                <p className="mt-2 text-[11px] text-stamp inline-flex items-center gap-1">
                  <Stamp size={13} /> Carimbo registrado nesta viagem
                </p>
              )}
            </section>

            {/* Fotos */}
            <section>
              <h3 className="text-[11px] uppercase tracking-wider text-earth mb-2">Fotos</h3>
              {photos.length === 0 ? (
                <p className="text-sm text-earth/70">Nenhuma foto neste lugar.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 items-start">
                    {photos.map((p, i) => {
                      const isPrimary =
                        p.is_primary || (!photos.some((x) => x.is_primary) && i === 0)
                      return (
                        <div key={p.id} className={`photo-thumb-wrap ${isPrimary ? 'col-span-2' : ''}`}>
                          <AnalogPhoto
                            src={p.url}
                            thumb={!isPrimary}
                            imgClassName={isPrimary ? 'h-40' : 'h-[4.5rem]'}
                            stampLabel={isPrimary ? journey.title : undefined}
                            stampDate={isPrimary ? stampDate : undefined}
                            onClick={() => openLightbox(i)}
                          />
                        </div>
                      )
                    })}
                  </div>
                  {photos.length > 1 && (
                    <button type="button" className="chip mt-2 text-xs" onClick={() => openLightbox(0)}>
                      Ver galeria
                    </button>
                  )}
                </>
              )}
            </section>

            {/* Comentários */}
            <section>
              <h3 className="text-[11px] uppercase tracking-wider text-earth mb-2 flex items-center gap-1">
                <Lightbulb size={14} /> Comentários
              </h3>
              {marker.annotations.length === 0 ? (
                <p className="text-sm text-earth/70">Nenhum comentário neste lugar.</p>
              ) : (
                <ul className="space-y-3">
                  {marker.annotations.map((a) => {
                    const meta = TYPE_LABELS[a.type] ?? TYPE_LABELS.note
                    const { Icon, label } = meta
                    const when = a.created_at
                      ? new Date(a.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : null
                    const who =
                      a.author_name || (a.author_username ? `@${a.author_username}` : 'viajante')
                    return (
                      <li
                        key={a.id}
                        className={`place-modal-comment place-modal-comment--${a.type === 'quote' || a.type === 'idea' || a.type === 'moment' ? a.type : 'note'}`}
                      >
                        <span className="place-modal-comment__type">
                          <Icon size={12} aria-hidden />
                          {label}
                        </span>
                        <p className="place-modal-comment__body">“{a.body}”</p>
                        <p className="place-modal-comment__meta">
                          {who}
                          {when ? ` · ${when}` : ''}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {marker.note?.trim() && (
              <section>
                <h3 className="text-[11px] uppercase tracking-wider text-earth mb-2">Observação</h3>
                <p className="text-sm text-ink/90 whitespace-pre-wrap border-l-2 border-earth/30 pl-3">
                  {marker.note}
                </p>
              </section>
            )}
          </div>
        </div>
      </div>

      <AnalogLightbox
        open={lightboxOpen}
        index={lightboxIndex}
        slides={photos.map((p) => ({ src: p.url, caption: p.caption || marker.title }))}
        stampLabel={journey.title}
        stampDate={stampDate}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIndex}
      />
    </>
  )
}
