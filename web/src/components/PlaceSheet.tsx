import { useRef, useState } from 'react'
import { Lightbulb, Link2, Quote, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { api, type Marker } from '../lib/api'
import { AnalogPhoto } from './AnalogPhoto'
import { AnalogLightbox } from './AnalogLightbox'

const ANN_TYPES = [
  { value: 'note', label: 'Nota', Icon: Lightbulb },
  { value: 'quote', label: 'Frase', Icon: Quote },
  { value: 'idea', label: 'Ideia', Icon: Sparkles },
  { value: 'moment', label: 'Momento', Icon: Sparkles },
]

export const MAX_PHOTOS = 10

type Props = {
  marker: Marker
  editable?: boolean
  slug: string
  expeditionLabel?: string
  expeditionDate?: string | null
  onClose: () => void
  onChanged: () => void
  onDeliverMap?: () => void
}

export function PlaceSheet({
  marker,
  editable,
  slug,
  expeditionLabel,
  expeditionDate,
  onClose,
  onChanged,
  onDeliverMap,
}: Props) {
  const [subtitle, setSubtitle] = useState(marker.subtitle)
  const [note, setNote] = useState(marker.note)
  const [annType, setAnnType] = useState('note')
  const [annBody, setAnnBody] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const photos = marker.attachments.filter((a) => a.kind === 'photo')
  const links = marker.attachments.filter((a) => a.kind === 'link')
  const slotsLeft = MAX_PHOTOS - photos.length
  const stampDate = expeditionDate
    ? new Date(expeditionDate + (expeditionDate.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR', {
        month: 'short',
        year: '2-digit',
      })
    : undefined

  async function saveMeta() {
    setBusy(true)
    try {
      await api.updateMarker(slug, marker.id, { subtitle, note })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function addAnnotation() {
    if (!annBody.trim()) return
    setBusy(true)
    try {
      await api.addAnnotation(slug, marker.id, { type: annType, body: annBody.trim() })
      setAnnBody('')
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function uploadPhotos(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!list.length) return

    if (list.length > slotsLeft) {
      setUploadError(`Limite de ${MAX_PHOTOS} fotos. Você pode adicionar mais ${slotsLeft}.`)
      return
    }

    setBusy(true)
    setUploadError('')
    try {
      for (const file of list) {
        const { url } = await api.upload(file)
        await api.addAttachment(slug, marker.id, { kind: 'photo', url })
      }
      onChanged()
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Falha no upload')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removePhoto(id: string) {
    if (!confirm('Remover esta foto?')) return
    setBusy(true)
    try {
      await api.deleteAttachment(slug, marker.id, id)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function setPrimary(id: string) {
    setBusy(true)
    try {
      await api.setPrimaryPhoto(slug, marker.id, id)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function addLink() {
    if (!linkUrl.trim()) return
    setBusy(true)
    try {
      await api.addAttachment(slug, marker.id, { kind: 'link', url: linkUrl.trim() })
      setLinkUrl('')
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  function openLightbox(i: number) {
    setLightboxIndex(i)
    setLightboxOpen(true)
  }

  return (
    <>
      <aside className="map-ui-overlay !pointer-events-none">
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 md:inset-y-4 md:left-4 md:right-auto md:bottom-4 md:w-[380px] max-h-[75vh] md:max-h-[calc(100%-2rem)] overflow-y-auto rounded-t-2xl md:rounded-sm border border-ink/25 bg-paper shadow-2xl paper-grain doc-frame">
          <div className="sticky top-0 bg-paper/95 backdrop-blur border-b border-dashed border-ink/20 px-4 py-3 flex items-start justify-between gap-3 z-10">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl">{marker.title}</h2>
              <p className="text-[10px] uppercase text-earth mt-0.5">Cidade do carimbo</p>
              {editable ? (
                <input
                  className="w-full mt-1 text-sm text-earth bg-transparent outline-none"
                  placeholder="Detalhe opcional (bairro, ponto…)"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  onBlur={() => void saveMeta()}
                />
              ) : (
                marker.subtitle && <p className="text-sm text-earth mt-1">{marker.subtitle}</p>
              )}
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-sand" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          <div className="p-4 space-y-5">
            <div className="flex gap-2 flex-wrap">
              <a
                className="chip"
                href={`https://www.openstreetmap.org/?mlat=${marker.lat}&mlon=${marker.lng}#map=16/${marker.lat}/${marker.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                Ver no OpenStreetMap
              </a>
              <button type="button" className="chip" onClick={() => onDeliverMap?.()}>
                Compartilhar mapa
              </button>
            </div>

            <section>
              <div className="flex items-end justify-between gap-2 mb-2">
                <h3 className="text-[11px] uppercase tracking-wider text-earth">Fotos</h3>
                <p className="text-[10px] text-earth/70">
                  {photos.length}/{MAX_PHOTOS} · máx. {MAX_PHOTOS} fotos
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 items-start">
                {photos.map((p, i) => {
                  const isPrimary = p.is_primary || (!photos.some((x) => x.is_primary) && i === 0)
                  return (
                  <div key={p.id} className={`photo-thumb-wrap ${isPrimary ? 'col-span-2' : ''}`}>
                    <AnalogPhoto
                      src={p.url}
                      thumb={!isPrimary}
                      imgClassName={isPrimary ? 'h-36' : 'h-[4.5rem]'}
                      stampLabel={isPrimary ? expeditionLabel : undefined}
                      stampDate={isPrimary ? stampDate : undefined}
                      onClick={() => openLightbox(i)}
                    />
                    {editable && (
                      <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1 justify-end">
                        {!isPrimary && (
                          <button
                            type="button"
                            className="text-[9px] uppercase bg-paper/90 border border-ink/20 px-1.5 py-0.5 hover:bg-sky"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation()
                              void setPrimary(p.id)
                            }}
                          >
                            Principal
                          </button>
                        )}
                        {isPrimary && (
                          <span className="text-[9px] uppercase bg-stamp text-cream px-1.5 py-0.5">
                            Principal
                          </span>
                        )}
                        <button
                          type="button"
                          className="photo-remove !static"
                          title="Remover foto"
                          aria-label="Remover foto"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation()
                            void removePhoto(p.id)
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  )
                })}

                {editable && slotsLeft > 0 && (
                  <label className="h-[4.5rem] border border-dashed border-ink/30 flex flex-col items-center justify-center text-xs text-earth cursor-pointer hover:bg-sand/40 bg-cream/50">
                    <Upload size={16} />
                    {busy ? '…' : 'Adicionar'}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => {
                        const files = e.target.files
                        if (files?.length) void uploadPhotos(files)
                      }}
                    />
                  </label>
                )}
              </div>

              {editable && (
                <p className="text-[10px] text-earth/70 mt-2">
                  Selecione várias imagens de uma vez. Limite de {MAX_PHOTOS} fotos por cidade
                  {slotsLeft === 0 ? ' (limite atingido).' : ` (${slotsLeft} restantes).`}
                </p>
              )}
              {uploadError && <p className="text-xs text-red-800 mt-1">{uploadError}</p>}
              {photos.length === 0 && !editable && (
                <p className="text-sm text-earth/70">Nenhuma foto neste ponto.</p>
              )}
              {photos.length > 0 && (
                <button
                  type="button"
                  className="chip mt-2 text-xs"
                  onClick={() => openLightbox(0)}
                >
                  Ver galeria
                </button>
              )}
            </section>

            <section>
              <h3 className="text-[11px] uppercase tracking-wider text-earth mb-2 flex items-center gap-1">
                <Lightbulb size={14} /> Anotações pessoais
              </h3>
              <ul className="space-y-3">
                {marker.annotations.map((a) => {
                  const when = a.created_at
                    ? new Date(a.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : null
                  const who = a.author_name || (a.author_username ? `@${a.author_username}` : '')
                  return (
                    <li key={a.id} className="border-l-2 border-stamp/50 pl-3 py-0.5">
                      <div className="flex gap-2 items-start text-sm">
                        <span className="flex-1">
                          <span className="text-[10px] uppercase text-stamp mr-2">{a.type}</span>
                          <span className="italic text-ink/90">“{a.body}”</span>
                        </span>
                        {editable && (
                          <button
                            type="button"
                            className="text-earth/50 hover:text-earth shrink-0"
                            onClick={() => void api.deleteAnnotation(slug, marker.id, a.id).then(onChanged)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {(who || when) && (
                        <p className="mt-1.5 text-[11px] text-earth font-script text-base leading-none">
                          — {who || 'viajante'}
                          {when ? `, ${when}` : ''}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
              {editable && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-1 flex-wrap">
                    {ANN_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setAnnType(t.value)}
                        className={`text-xs px-2 py-1 rounded-full border ${
                          annType === t.value ? 'bg-stamp text-cream border-stamp' : 'border-ink/20'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="w-full border border-dashed border-ink/30 bg-cream/60 p-2 text-sm outline-none focus:border-stamp"
                    rows={2}
                    placeholder="Escreva uma nota, frase ou ideia…"
                    value={annBody}
                    onChange={(e) => setAnnBody(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || !annBody.trim()}
                    onClick={() => void addAnnotation()}
                    className="w-full rounded-xl bg-sky text-ink font-medium py-2.5 disabled:opacity-50"
                  >
                    Adicionar anotação
                  </button>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-[11px] uppercase tracking-wider text-earth mb-2 flex items-center gap-1">
                <Link2 size={14} /> Anexos e links
              </h3>
              <ul className="space-y-1 text-sm">
                {links.map((l) => (
                  <li key={l.id} className="flex items-center gap-2">
                    <a className="text-stamp underline truncate flex-1" href={l.url} target="_blank" rel="noreferrer">
                      {l.caption || l.url}
                    </a>
                    {editable && (
                      <button
                        type="button"
                        onClick={() => void api.deleteAttachment(slug, marker.id, l.id).then(onChanged)}
                      >
                        <Trash2 size={14} className="text-earth/50" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {editable && (
                <div className="mt-2 flex gap-2">
                  <input
                    className="flex-1 border border-dashed border-ink/30 bg-cream/60 px-3 py-2 text-sm outline-none"
                    placeholder="https://…"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                  />
                  <button type="button" onClick={() => void addLink()} className="rounded-xl bg-earth text-cream px-3 text-sm">
                    +
                  </button>
                </div>
              )}
            </section>

            {editable && (
              <section>
                <h3 className="text-[11px] uppercase tracking-wider text-earth mb-2">Nota</h3>
                <textarea
                  className="w-full border border-dashed border-ink/30 bg-cream/60 p-2 text-sm outline-none"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={() => void saveMeta()}
                />
                <button
                  type="button"
                  className="mt-3 w-full border border-ink/30 py-2 text-sm text-earth hover:bg-sand/50"
                  onClick={() => {
                    if (confirm('Remover este lugar do mapa?')) {
                      void api.deleteMarker(slug, marker.id).then(() => {
                        onClose()
                        onChanged()
                      })
                    }
                  }}
                >
                  Remover lugar
                </button>
              </section>
            )}
          </div>
        </div>
      </aside>

      <AnalogLightbox
        open={lightboxOpen}
        index={lightboxIndex}
        slides={photos.map((p) => ({ src: p.url, caption: p.caption || marker.title }))}
        stampLabel={expeditionLabel}
        stampDate={stampDate}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIndex}
      />
    </>
  )
}
