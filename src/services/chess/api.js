import { API_BASE_URL, apiRequest } from '../api/client.js'

export function chessSocketUrl(base = API_BASE_URL) {
  const url = new URL(`${base.replace(/\/+$/, '')}/chess/ws`)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.search = ''
  url.hash = ''
  return url.toString()
}

export const CHESS_WS_URL = chessSocketUrl()

export const chessApi = {
  bots: () => apiRequest('/chess/bots', { auth: false }),
  lobby: () => apiRequest('/chess/lobby', { auth: false }),
  seasons: () => apiRequest('/chess/seasons', { auth: false }),
}
