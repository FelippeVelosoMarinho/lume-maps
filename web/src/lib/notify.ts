import toast from 'react-hot-toast'

/** Rotas GET (e similares) que não disparam toast de sucesso. */
function isSilentSuccess(method: string, path: string) {
  const m = method.toUpperCase()
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return true
  if (path.startsWith('/auth/refresh')) return true
  if (path === '/auth/me') return true
  if (path.startsWith('/passports/search')) return true
  return false
}

/** Erros de auth refresh/me não spamam toast (o fluxo de login trata). */
function isSilentError(path: string) {
  if (path.startsWith('/auth/refresh')) return true
  if (path === '/auth/me') return true
  return false
}

function successMessage(method: string, path: string): string {
  const m = method.toUpperCase()
  const p = path

  if (p === '/auth/signup') return 'Conta criada'
  if (p === '/auth/login') return 'Login feito'
  if (p === '/auth/me/passport' && m === 'PATCH') return 'Passaporte atualizado'
  if (p === '/upload' || p.startsWith('/upload')) return 'Arquivo enviado'
  if (p === '/journeys' && m === 'POST') return 'Mapa criado'
  if (/^\/journeys\/[^/]+$/.test(p) && m === 'PATCH') return 'Mapa atualizado'
  if (/^\/journeys\/[^/]+$/.test(p) && m === 'DELETE') return 'Mapa apagado'
  if (p.includes('/reorder-markers')) return 'Ordem do caminho atualizada'
  if (p.includes('/companions') && m === 'POST') return 'Pessoa adicionada ao mapa'
  if (p.includes('/companions') && m === 'DELETE') return 'Pessoa removida do mapa'
  if (p.endsWith('/join') && m === 'POST') return 'Mapa adicionado ao seu passaporte'
  if (p.includes('/markers') && m === 'POST' && !p.includes('/annotations') && !p.includes('/attachments')) {
    return 'Cidade carimbada'
  }
  if (p.includes('/markers/') && m === 'PATCH') return 'Lugar atualizado'
  if (p.includes('/markers/') && m === 'DELETE' && !p.includes('/annotations') && !p.includes('/attachments')) {
    return 'Lugar removido'
  }
  if (p.includes('/annotations') && m === 'POST') return 'Anotação adicionada'
  if (p.includes('/annotations') && m === 'DELETE') return 'Anotação removida'
  if (p.includes('/attachments') && p.endsWith('/primary') && m === 'POST') return 'Foto principal definida'
  if (p.includes('/attachments') && m === 'POST') return 'Anexo adicionado'
  if (p.includes('/attachments') && m === 'DELETE') return 'Anexo removido'

  if (m === 'POST') return 'Criado com sucesso'
  if (m === 'PUT' || m === 'PATCH') return 'Salvo com sucesso'
  if (m === 'DELETE') return 'Removido com sucesso'
  return 'Pronto'
}

export function notifyRequestSuccess(method: string, path: string) {
  if (isSilentSuccess(method, path)) return
  toast.success(successMessage(method, path))
}

export function notifyRequestError(method: string, path: string, detail: string) {
  if (isSilentError(path)) return
  const msg = detail?.trim() || 'Erro na requisição'
  toast.error(msg)
}

export { toast }
