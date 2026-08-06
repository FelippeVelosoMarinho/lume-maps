import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Share2, Trash2 } from 'lucide-react'
import { api, type Passport, type PassportTravels } from '../lib/api'
import { formatPeriod } from '../lib/dates'
import { toast } from '../lib/notify'
import { useAuth } from '../contexts/AuthContext'
import { Shell } from '../components/Shell'
import { PassportCard, StampSeal } from '../components/PassportCard'
import { PassportInviteView } from '../components/PassportInviteView'
import { PassportTravelsMap } from '../components/PassportTravelsMap'

export function PassportPage() {
  const { username } = useParams()
  const navigate = useNavigate()
  const { me, refresh, loading: authLoading } = useAuth()
  const [passport, setPassport] = useState<Passport | null>(null)
  const [travels, setTravels] = useState<PassportTravels | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const isOwner = me?.passport.username === username

  useEffect(() => {
    if (!username) return
    api
      .getPassport(username)
      .then(setPassport)
      .catch((e) => setError(e.message))
    if (isOwner || me?.passport.username === username) {
      api
        .getPassportTravels(username)
        .then(setTravels)
        .catch(() => setTravels(null))
    } else {
      setTravels(null)
    }
  }, [username, isOwner, me?.passport.username])

  async function share() {
    if (!me?.passport) {
      toast.error('Para compartilhar, você precisa ter um passaporte registrado.')
      navigate('/auth')
      return
    }
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: `Passaporte de ${passport?.display_name}`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      toast.success('Link do passaporte copiado')
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(url)
        toast.success('Link do passaporte copiado')
      } catch {
        toast.error('Não foi possível copiar o link')
      }
    }
  }

  async function onPhoto(file: File) {
    if (!isOwner) return
    const { url } = await api.upload(file)
    const updated = await api.updatePassport({ photo_url: url })
    setPassport((p) => (p ? { ...p, ...updated, stamps: p.stamps, journeys: p.journeys } : p))
    await refresh()
  }

  async function savePassport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!passport) return
    setBusy(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const dob = String(fd.get('date_of_birth') || '')
    try {
      const updated = await api.updatePassport({
        display_name: String(fd.get('display_name') || passport.display_name),
        place_of_issue: String(fd.get('place_of_issue') || ''),
        signature: String(fd.get('signature') || ''),
        date_of_birth: dob || null,
      } as Partial<Passport>)
      setPassport((p) => (p ? { ...p, ...updated, stamps: p.stamps, journeys: p.journeys } : p))
      await refresh()
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setBusy(false)
    }
  }

  async function deleteMap(slug: string, title: string) {
    if (
      !confirm(
        `Apagar o mapa “${title}”? Isso remove lugares, fotos e carimbos ligados a ele. Não dá para desfazer.`,
      )
    ) {
      return
    }
    try {
      await api.deleteJourney(slug)
      if (!username) return
      const [p, t] = await Promise.all([
        api.getPassport(username),
        api.getPassportTravels(username).catch(() => null),
      ])
      setPassport(p)
      setTravels(t)
    } catch {
      /* toast via api */
    }
  }

  async function shareMap(slug: string, title: string) {
    const url = `${window.location.origin}/v/${slug}`
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: `Veja o mapa “${title}” no Lume Maps`,
          url,
        })
        return
      }
      await navigator.clipboard.writeText(url)
      toast.success('Link do mapa copiado')
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(url)
        toast.success('Link do mapa copiado')
      } catch {
        toast.error('Não foi possível copiar o link')
      }
    }
  }

  if (authLoading && passport) {
    return (
      <Shell compact>
        <p className="text-earth px-4 py-10">Carregando…</p>
      </Shell>
    )
  }

  if (passport && !isOwner) {
    return (
      <Shell compact>
        {error && <p className="text-red-800 px-4 py-2 text-sm">{error}</p>}
        <PassportInviteView
          passport={passport}
          showSignup={!me}
          myPassportHref={me ? `/p/${me.passport.username}` : undefined}
        />
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="mx-auto max-w-4xl px-3 sm:px-4 py-8 sm:py-10 space-y-8 sm:space-y-10 min-w-0">
        {error && <p className="text-red-800">{error}</p>}
        {!passport && !error && <p className="text-earth">Carregando…</p>}

        {passport && isOwner && (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-2xl uppercase tracking-wide text-ink">
                Meu passaporte
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="chip" onClick={() => setEditing((v) => !v)}>
                  {editing ? 'Cancelar edição' : 'Editar dados'}
                </button>
                <button
                  type="button"
                  onClick={() => void share()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-stamp text-cream px-5 py-2.5 text-sm font-medium shadow-sm hover:brightness-110 min-h-11"
                >
                  <Share2 size={16} strokeWidth={2} />
                  Compartilhar
                </button>
                <Link
                  to="/nova-viagem"
                  className="inline-flex items-center justify-center rounded-xl bg-earth text-cream px-5 py-2.5 text-sm font-medium shadow-sm hover:brightness-110 min-h-11"
                >
                  Criar mapa
                </Link>
              </div>
            </div>

            {editing ? (
              <form onSubmit={savePassport} className="paper-grain doc-frame bg-paper p-5 space-y-3">
                <div className="star-border mb-2 opacity-50" />
                <h3 className="font-display uppercase text-lg">Editar passaporte</h3>
                <label className="block text-sm">
                  <span className="text-[11px] uppercase text-earth">Nome</span>
                  <input
                    name="display_name"
                    defaultValue={passport.display_name}
                    required
                    className="mt-1 w-full border border-dashed border-ink/30 bg-cream px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-[11px] uppercase text-earth">Cidade</span>
                  <input
                    name="place_of_issue"
                    defaultValue={passport.place_of_issue}
                    className="mt-1 w-full border border-dashed border-ink/30 bg-cream px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-[11px] uppercase text-earth">Nascimento</span>
                  <input
                    name="date_of_birth"
                    type="date"
                    defaultValue={passport.date_of_birth ?? ''}
                    className="mt-1 w-full border border-dashed border-ink/30 bg-cream px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-[11px] uppercase text-earth">Assinatura</span>
                  <input
                    name="signature"
                    defaultValue={passport.signature}
                    className="mt-1 w-full border border-dashed border-ink/30 bg-cream px-3 py-2"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-earth text-cream py-2.5 font-medium disabled:opacity-50"
                >
                  {busy ? 'Salvando…' : 'Salvar'}
                </button>
              </form>
            ) : (
              <PassportCard passport={passport} onPhotoChange={onPhoto} />
            )}

            <section>
              <div className="flex items-end justify-between mb-4">
                <h3 className="font-display uppercase tracking-wide text-lg">Onde passou</h3>
                <p className="text-xs text-earth">
                  {travels?.journeys.length ?? 0}{' '}
                  {(travels?.journeys.length ?? 0) === 1 ? 'viagem' : 'viagens'}
                </p>
              </div>
              <div className="paper-grain doc-frame bg-paper p-4 md:p-5">
                <PassportTravelsMap journeys={travels?.journeys ?? []} />
              </div>
            </section>

            <section>
              <div className="flex items-end justify-between mb-4">
                <h3 className="font-display uppercase tracking-wide text-lg">Carimbos</h3>
                <p className="text-xs text-earth">{passport.stamps.length} lugares</p>
              </div>
              <div className="paper-grain doc-frame bg-paper-aged/80 p-5">
                {passport.stamps.length === 0 ? (
                  <p className="text-sm text-earth">
                    Nenhum carimbo ainda. Crie um mapa e marque lugares para aparecerem aqui.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6 place-items-center">
                    {passport.stamps.map((s) => {
                      const journeySlug =
                        s.journey_slug ||
                        passport.journeys.find((j) => j.id === s.journey_id)?.slug
                      const seal = (
                        <div className="scale-[0.88] sm:scale-100 origin-center">
                          <StampSeal stamp={s} />
                        </div>
                      )
                      return journeySlug ? (
                        <Link key={s.id} to={`/v/${journeySlug}`} title="Abrir mapa">
                          {seal}
                        </Link>
                      ) : (
                        <div key={s.id}>{seal}</div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>

            <section>
              <h3 className="font-display uppercase tracking-wide text-lg mb-4">Mapas</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {passport.journeys.map((j) => (
                  <div key={j.id} className="doc-frame bg-cream p-4 relative group min-w-0">
                    <Link to={`/v/${j.slug}`} className="block hover:opacity-90 min-w-0">
                      <p className="font-display flex items-center gap-2 pr-16 min-w-0">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: j.color || 'var(--color-stamp)' }}
                        />
                        <span className="truncate">{j.title}</span>
                      </p>
                      <p className="text-sm text-earth mt-1 line-clamp-2">
                        {j.subtitle || 'Sem descrição'}
                      </p>
                      {formatPeriod(j.started_on, j.ended_on) && (
                        <p className="text-xs font-mono text-stamp mt-1">
                          {formatPeriod(j.started_on, j.ended_on)}
                        </p>
                      )}
                      <span className="text-xs text-earth mt-2 inline-block">
                        {j.is_mine === false ? 'Abrir mapa →' : 'Abrir / editar →'}
                      </span>
                    </Link>
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5">
                      <button
                        type="button"
                        title="Compartilhar mapa"
                        aria-label={`Compartilhar ${j.title}`}
                        className="p-2.5 min-w-10 min-h-10 inline-flex items-center justify-center rounded-full text-earth/50 hover:text-stamp hover:bg-sand/60"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          void shareMap(j.slug, j.title)
                        }}
                      >
                        <Share2 size={16} />
                      </button>
                      {j.is_mine !== false && (
                        <button
                          type="button"
                          title="Apagar mapa"
                          aria-label={`Apagar ${j.title}`}
                          className="p-2.5 min-w-10 min-h-10 inline-flex items-center justify-center rounded-full text-earth/50 hover:text-red-900 hover:bg-red-50"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            void deleteMap(j.slug, j.title)
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {passport.journeys.length === 0 && (
                  <p className="text-sm text-earth">Nenhum mapa ainda.</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </Shell>
  )
}
