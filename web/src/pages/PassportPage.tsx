import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { api, type Passport, type PassportTravels } from '../lib/api'
import { formatPeriod } from '../lib/dates'
import { useAuth } from '../contexts/AuthContext'
import { Shell } from '../components/Shell'
import { PassportCard, StampSeal } from '../components/PassportCard'
import { PassportTravelsMap } from '../components/PassportTravelsMap'

export function PassportPage() {
  const { username } = useParams()
  const navigate = useNavigate()
  const { me, refresh } = useAuth()
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
    api
      .getPassportTravels(username)
      .then(setTravels)
      .catch(() => setTravels(null))
  }, [username])

  async function share() {
    if (!me?.passport) {
      alert('Para compartilhar um link, você precisa ter um passaporte registrado.')
      navigate('/auth')
      return
    }
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: `Passaporte de ${passport?.display_name}`, url })
    } else {
      await navigator.clipboard.writeText(url)
      alert('Link copiado!')
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
        bio: String(fd.get('bio') || ''),
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

  return (
    <Shell>
      <div className="mx-auto max-w-4xl px-4 py-10 space-y-10">
        {error && <p className="text-red-800">{error}</p>}
        {!passport && !error && <p className="text-earth">Carregando…</p>}

        {passport && (
          <>
            {isOwner ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-2xl uppercase tracking-wide text-ink">
                  Meu passaporte
                </h2>
                <div className="flex gap-2 flex-wrap">
                  <button type="button" onClick={() => void share()} className="chip">
                    Compartilhar
                  </button>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => setEditing((v) => !v)}
                  >
                    {editing ? 'Cancelar edição' : 'Editar dados'}
                  </button>
                  <label className="chip cursor-pointer">
                    Foto
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void onPhoto(f)
                      }}
                    />
                  </label>
                  <Link
                    to="/nova-viagem"
                    className="rounded-xl bg-earth text-cream px-4 py-2 text-sm font-medium"
                  >
                    Criar mapa
                  </Link>
                </div>
              </div>
            ) : (
              <section className="text-center space-y-3 pt-2 pb-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-stamp">Lume Maps</p>
                <h1 className="font-display text-2xl md:text-4xl leading-snug text-ink max-w-2xl mx-auto">
                  O {passport.display_name} te chama pra ficarmos perdidos juntos…
                  <span className="ml-1" aria-hidden>
                    🥺
                  </span>
                </h1>
                <p className="text-sm text-earth font-script text-2xl">@{passport.username}</p>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  <button type="button" onClick={() => void share()} className="chip">
                    Compartilhar
                  </button>
                  {!me && (
                    <Link
                      to="/auth"
                      className="rounded-xl bg-earth text-cream px-4 py-2 text-sm font-medium"
                    >
                      Criar meu passaporte
                    </Link>
                  )}
                </div>
              </section>
            )}

            {editing && isOwner ? (
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
                <label className="block text-sm">
                  <span className="text-[11px] uppercase text-earth">Bio</span>
                  <textarea
                    name="bio"
                    rows={3}
                    defaultValue={passport.bio}
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
              <PassportCard passport={passport} />
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
                    Nenhum carimbo ainda.{' '}
                    {isOwner ? 'Crie um mapa e marque lugares para aparecerem aqui.' : ''}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 place-items-center">
                    {passport.stamps.map((s) => {
                      const journeySlug =
                        s.journey_slug || passport.journeys.find((j) => j.id === s.journey_id)?.slug
                      const seal = <StampSeal stamp={s} />
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
                  <div key={j.id} className="doc-frame bg-cream p-4 relative group">
                    <Link to={`/v/${j.slug}`} className="block hover:opacity-90">
                      <p className="font-display flex items-center gap-2 pr-8">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: j.color || 'var(--color-stamp)' }}
                        />
                        {j.title}
                      </p>
                      <p className="text-sm text-earth mt-1 line-clamp-2">{j.subtitle || 'Sem descrição'}</p>
                      {formatPeriod(j.started_on, j.ended_on) && (
                        <p className="text-xs font-mono text-stamp mt-1">
                          {formatPeriod(j.started_on, j.ended_on)}
                        </p>
                      )}
                      {isOwner && (
                        <span className="text-xs text-earth mt-2 inline-block">Abrir / editar →</span>
                      )}
                    </Link>
                    {isOwner && (
                      <button
                        type="button"
                        title="Apagar mapa"
                        aria-label={`Apagar ${j.title}`}
                        className="absolute top-3 right-3 p-1.5 rounded-full text-earth/50 hover:text-red-900 hover:bg-red-50"
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
