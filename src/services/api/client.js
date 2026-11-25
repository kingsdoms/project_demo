const DEFAULT_API_BASE_URL = 'https://thesaurus-divinity-cosigner.ngrok-free.dev/api'
const SESSION_KEY = 'co-the.auth-session.v1'
const REQUEST_TIMEOUT_MS = 30_000

export const API_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(message, { status = 0, cause } = {}) {
    super(message, { cause })
    this.name = 'ApiError'
    this.status = status
  }
}

let memorySession = null
let memoryOnly = false
let refreshRequest = null

function storage() {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

export function getAuthSession() {
  if (memoryOnly) return memorySession
  const store = storage()
  if (store) {
    try {
      const saved = store.getItem(SESSION_KEY)
      memorySession = saved ? JSON.parse(saved) : null
    } catch {
      memorySession = null
    }
  }
  return memorySession
}

export function setAuthSession(session, { persist = !memoryOnly } = {}) {
  memoryOnly = !persist
  memorySession = {
    accessToken: session.accessToken ?? session.access_token,
    refreshToken: session.refreshToken ?? session.refresh_token ?? null,
    accessExp: session.accessExp ?? session.access_exp ?? null,
    refreshExp: session.refreshExp ?? session.refresh_exp ?? null,
    roles: Array.isArray(session.roles) ? session.roles : [],
  }

  try {
    if (persist) storage()?.setItem(SESSION_KEY, JSON.stringify(memorySession))
    else storage()?.removeItem(SESSION_KEY)
  } catch {
    // Keep the active tab signed in if the browser blocks sessionStorage.
    memoryOnly = true
  }
}

export function clearAuthSession() {
  memorySession = null
  memoryOnly = false
  try {
    storage()?.removeItem(SESSION_KEY)
  } catch {
    // Nothing else to clear when browser storage is unavailable.
  }
}

// This only reads expiry metadata. Authentication always remains the server's job.
function tokenExpiry(token) {
  try {
    const encoded = token.split('.')[1]
    const payload = JSON.parse(globalThis.atob(encoded.replace(/-/g, '+').replace(/_/g, '/')))
    return Number.isFinite(payload.exp) ? payload.exp : null
  } catch { return null }
}

export async function ensureAccessToken({ forceRefresh = false, minValiditySeconds = 45 } = {}) {
  const session = getAuthSession()
  if (!session?.accessToken) {
    throw new ApiError('Bạn cần đăng nhập để kết nối bàn cờ.', { status: 401 })
  }
  const expires = tokenExpiry(session.accessToken) ?? session.accessExp
  if (forceRefresh || (expires != null && expires <= Date.now() / 1000 + minValiditySeconds)) {
    const token = await refreshAccessToken(session)
    if (!token) throw new ApiError('Phiên đã hết hạn. Hãy đăng nhập lại.', { status: 401 })
    return token
  }
  return session.accessToken
}

async function readResponse(response) {
  if (response.status === 204) return null

  let payload
  try {
    payload = await response.json()
  } catch (cause) {
    const statusMessage = {
      401: 'Phiên đăng nhập chưa hợp lệ hoặc đã hết hạn. Hãy đăng nhập lại.',
      403: 'Bạn không có quyền thực hiện thao tác này.',
      429: 'Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau.',
    }[response.status]
    throw new ApiError(
      statusMessage || (response.ok
        ? 'Máy chủ trả về dữ liệu không hợp lệ. Hãy kiểm tra địa chỉ API.'
        : `Máy chủ trả về lỗi HTTP ${response.status}. Vui lòng thử lại.`),
      { status: response.status, cause },
    )
  }

  if (!response.ok || payload?.success === false) {
    throw new ApiError(payload?.message || 'Yêu cầu không thành công.', {
      status: response.status,
    })
  }

  return payload && Object.hasOwn(payload, 'value') ? payload.value : payload
}

async function fetchJson(path, { method, body, token, headers: extraHeaders = {} }) {
  const headers = { Accept: 'application/json', ...extraHeaders }
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  if (API_BASE_URL.includes('.ngrok-free.dev')) {
    headers['ngrok-skip-browser-warning'] = 'true'
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (cause) {
    if (cause?.name === 'AbortError') {
      throw new ApiError('Máy chủ phản hồi quá lâu. Hãy thử lại.', { cause })
    }
    throw new ApiError(
      'Không thể kết nối máy chủ. Hãy kiểm tra mạng và thử lại.',
      { cause },
    )
  } finally {
    clearTimeout(timeout)
  }

  return readResponse(response)
}

async function refreshAccessToken(session) {
  if (!session?.refreshToken || !session.accessToken) return null
  if (!refreshRequest || refreshRequest.key !== session.refreshToken) {
    const request = { key: session.refreshToken, promise: null }
    request.promise = (async () => {
      try {
        const accessToken = await fetchJson('/auth/refresh-token', {
          method: 'POST',
          body: session.refreshToken,
          token: session.accessToken,
        })
        if (typeof accessToken !== 'string' || !accessToken) {
          throw new ApiError('Máy chủ không trả về access token mới.')
        }
        const latest = getAuthSession()
        if (!latest || latest.refreshToken !== session.refreshToken) {
          throw new ApiError('Phiên đăng nhập đã thay đổi. Hãy thực hiện lại thao tác.', { status: 401 })
        }
        setAuthSession({ ...latest, accessToken, accessExp: tokenExpiry(accessToken) })
        return accessToken
      } catch (error) {
        if (error instanceof ApiError && [401, 403].includes(error.status) && getAuthSession()?.refreshToken === session.refreshToken) {
          clearAuthSession()
        }
        throw error
      } finally {
        if (refreshRequest === request) refreshRequest = null
      }
    })()
    refreshRequest = request
  }
  return refreshRequest.promise
}

export async function apiRequest(
  path,
  { method = 'GET', body, auth = true, authToken, retry = true } = {},
) {
  const session = getAuthSession()
  const token = authToken ?? (auth ? session?.accessToken : null)
  try {
    return await fetchJson(path, { method, body, token })
  } catch (error) {
    if (
      retry &&
      auth &&
      error instanceof ApiError &&
      error.status === 401 &&
      session?.refreshToken
    ) {
      if (getAuthSession()?.refreshToken !== session.refreshToken) throw error
      const newToken = await refreshAccessToken(session)
      if (newToken) {
        return apiRequest(path, { method, body, auth, authToken: newToken, retry: false })
      }
    }
    throw error
  }
}
