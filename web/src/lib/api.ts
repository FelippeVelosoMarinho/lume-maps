import { notifyRequestError, notifyRequestSuccess } from './notify'

export type TokenPair = {
  access_token: string
  refresh_token: string
  token_type: string
}

export type Stamp = {
  id: string
  label: string
  rotation: number
  stamped_at: string
  marker_id: string
  journey_id: string
  journey_slug?: string | null
  journey_title?: string | null
  journey_started_on?: string | null
  journey_ended_on?: string | null
  primary_photo_url?: string | null
  colors?: string[]
  journey_titles?: string[]
}

export type JourneySummary = {
  id: string
  slug: string
  title: string
  subtitle: string
  cover_url: string | null
  started_on: string | null
  ended_on: string | null
  color?: string | null
  /** false quando o mapa é de outra pessoa (companheiro) */
  is_mine?: boolean
}

export type Passport = {
  id: string
  username: string
  display_name: string
  passport_number: string
  photo_url: string | null
  date_of_birth: string | null
  place_of_issue: string
  issued_at: string
  signature: string
  bio: string
  stamps: Stamp[]
  journeys: JourneySummary[]
}

export type Me = {
  id: string
  email: string
  passport: Passport
}

export type Annotation = {
  id: string
  type: string
  body: string
  author_name?: string
  author_username?: string
  sort_order: number
  created_at?: string | null
}

export type Attachment = {
  id: string
  kind: string
  url: string
  caption: string
  sort_order: number
  is_primary?: boolean
}

export type Marker = {
  id: string
  lat: number
  lng: number
  title: string
  city?: string
  subtitle: string
  note: string
  icon: string
  color: string
  sort_order: number
  is_departure?: boolean
  has_stamp?: boolean
  primary_photo_url?: string | null
  annotations: Annotation[]
  attachments: Attachment[]
}

export type TravelMarker = {
  id: string
  lat: number
  lng: number
  title: string
  sort_order: number
  is_departure?: boolean
  primary_photo_url?: string | null
}

export type TravelJourney = {
  id: string
  slug: string
  title: string
  color: string
  started_on: string | null
  ended_on: string | null
  markers: TravelMarker[]
}

export type PassportTravels = {
  username: string
  display_name: string
  journeys: TravelJourney[]
}

export type Companion = {
  user_id: string
  username: string
  display_name: string
  photo_url: string | null
}

export type PassportSearchHit = {
  username: string
  display_name: string
  photo_url: string | null
}

export type Journey = {
  id: string
  slug: string
  title: string
  subtitle: string
  cover_url: string | null
  playlist_url: string | null
  started_on: string | null
  ended_on: string | null
  is_public: boolean
  color?: string | null
  owner_username: string | null
  owner_display_name: string | null
  markers: Marker[]
  companions?: Companion[]
}

export const JOURNEY_COLOR_PALETTE = [
  '#2F6F73',
  '#C45C26',
  '#3D5A80',
  '#8B4513',
  '#6B4C9A',
  '#B8860B',
  '#2E8B57',
  '#A0522D',
]

const API_BASE = '/api'

type RequestOptions = RequestInit & { silent?: boolean }

class ApiClient {
  private accessToken: string | null = localStorage.getItem('mr_access')
  private refreshToken: string | null = localStorage.getItem('mr_refresh')

  setTokens(tokens: TokenPair | null) {
    if (!tokens) {
      this.accessToken = null
      this.refreshToken = null
      localStorage.removeItem('mr_access')
      localStorage.removeItem('mr_refresh')
      return
    }
    this.accessToken = tokens.access_token
    this.refreshToken = tokens.refresh_token
    localStorage.setItem('mr_access', tokens.access_token)
    localStorage.setItem('mr_refresh', tokens.refresh_token)
  }

  get isAuthed() {
    return !!this.accessToken
  }

  private async request<T>(path: string, init: RequestOptions = {}, retry = true): Promise<T> {
    const { silent, ...fetchInit } = init
    const method = (fetchInit.method || 'GET').toUpperCase()
    const headers = new Headers(fetchInit.headers)
    if (!(fetchInit.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json')
    }
    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`)
    }
    const res = await fetch(`${API_BASE}${path}`, { ...fetchInit, headers })
    if (res.status === 401 && retry && this.refreshToken) {
      const ok = await this.refresh()
      if (ok) return this.request<T>(path, init, false)
    }
    if (!res.ok) {
      let detail = 'Erro na requisição'
      try {
        const body = await res.json()
        detail = body.detail || detail
      } catch { /* ignore */ }
      const message = typeof detail === 'string' ? detail : JSON.stringify(detail)
      if (!silent) {
        notifyRequestError(method, path, message)
      }
      throw new Error(message)
    }
    if (!silent) {
      notifyRequestSuccess(method, path)
    }
    if (res.status === 204) return undefined as T
    return res.json()
  }

  private async refresh(): Promise<boolean> {
    if (!this.refreshToken) return false
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      })
      if (!res.ok) {
        this.setTokens(null)
        return false
      }
      const tokens = (await res.json()) as TokenPair
      this.setTokens(tokens)
      return true
    } catch {
      this.setTokens(null)
      return false
    }
  }

  signup(data: {
    email: string
    password: string
    username: string
    display_name: string
    place_of_issue?: string
    signature?: string
  }) {
    return this.request<TokenPair>('/auth/signup', { method: 'POST', body: JSON.stringify(data) })
  }

  login(email: string, password: string) {
    return this.request<TokenPair>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  me() {
    return this.request<Me>('/auth/me', { silent: true })
  }

  updatePassport(data: Partial<Passport>) {
    return this.request<Passport>('/auth/me/passport', {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  getPassport(username: string) {
    return this.request<Passport>(`/passports/${username}`, { silent: true })
  }

  getPassportTravels(username: string) {
    return this.request<PassportTravels>(`/passports/${username}/travels`, { silent: true })
  }

  searchPassports(q: string) {
    return this.request<PassportSearchHit[]>(`/passports/search?q=${encodeURIComponent(q)}`, {
      silent: true,
    })
  }

  createJourney(data: {
    title: string
    subtitle?: string
    playlist_url?: string
    started_on?: string | null
    ended_on?: string | null
    color?: string | null
  }) {
    return this.request<Journey>('/journeys', { method: 'POST', body: JSON.stringify(data) })
  }

  getJourney(slug: string) {
    return this.request<Journey>(`/journeys/${slug}`, { silent: true })
  }

  getJourneyEdit(slug: string) {
    return this.request<Journey>(`/journeys/${slug}/edit`, { silent: true })
  }

  updateJourney(
    slug: string,
    data: Partial<{
      title: string
      subtitle: string
      cover_url: string | null
      playlist_url: string | null
      started_on: string | null
      ended_on: string | null
      is_public: boolean
      color: string | null
    }>,
  ) {
    return this.request<Journey>(`/journeys/${slug}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  deleteJourney(slug: string) {
    return this.request<void>(`/journeys/${slug}`, { method: 'DELETE' })
  }

  addCompanion(slug: string, username: string) {
    return this.request<Companion[]>(`/journeys/${slug}/companions`, {
      method: 'POST',
      body: JSON.stringify({ username }),
    })
  }

  /** Entra no mapa (companheiro) — passa a aparecer no próprio passaporte. */
  joinJourney(slug: string) {
    return this.request<{ joined: boolean; journey: Journey }>(`/journeys/${slug}/join`, {
      method: 'POST',
      silent: true,
    })
  }

  removeCompanion(slug: string, username: string) {
    return this.request<void>(`/journeys/${slug}/companions/${encodeURIComponent(username)}`, {
      method: 'DELETE',
    })
  }

  createMarker(
    slug: string,
    data: Partial<Marker> & {
      lat: number
      lng: number
      title: string
      city?: string
      stamp?: boolean
      is_departure?: boolean
    },
  ) {
    return this.request<Marker>(`/journeys/${slug}/markers`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  updateMarker(slug: string, markerId: string, data: Partial<Marker>) {
    return this.request<Marker>(`/journeys/${slug}/markers/${markerId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  deleteMarker(slug: string, markerId: string) {
    return this.request<void>(`/journeys/${slug}/markers/${markerId}`, { method: 'DELETE' })
  }

  reorderMarkers(slug: string, markerIds: string[]) {
    return this.request<Journey>(`/journeys/${slug}/reorder-markers`, {
      method: 'PUT',
      body: JSON.stringify({ marker_ids: markerIds }),
    })
  }

  addAnnotation(slug: string, markerId: string, data: { type: string; body: string }) {
    return this.request<Annotation>(`/journeys/${slug}/markers/${markerId}/annotations`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  deleteAnnotation(slug: string, markerId: string, annId: string) {
    return this.request<void>(`/journeys/${slug}/markers/${markerId}/annotations/${annId}`, {
      method: 'DELETE',
    })
  }

  addAttachment(
    slug: string,
    markerId: string,
    data: { kind: string; url: string; caption?: string; is_primary?: boolean },
  ) {
    return this.request<Attachment>(`/journeys/${slug}/markers/${markerId}/attachments`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  setPrimaryPhoto(slug: string, markerId: string, attId: string) {
    return this.request<Marker>(`/journeys/${slug}/markers/${markerId}/attachments/${attId}/primary`, {
      method: 'POST',
    })
  }

  deleteAttachment(slug: string, markerId: string, attId: string) {
    return this.request<void>(`/journeys/${slug}/markers/${markerId}/attachments/${attId}`, {
      method: 'DELETE',
    })
  }

  async upload(file: File) {
    const form = new FormData()
    form.append('file', file)
    return this.request<{ url: string }>('/upload', { method: 'POST', body: form })
  }
}

export const api = new ApiClient()

export function mediaUrl(url: string | null | undefined) {
  if (!url) return null
  if (url.startsWith('http')) return url
  return url
}
