import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { setImmediate } from 'node:timers'
import {
  ApiError,
  API_BASE_URL,
  apiRequest,
  clearAuthSession,
  getAuthSession,
  ensureAccessToken,
  setAuthSession,
} from './client.js'

const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })
afterEach(() => clearAuthSession())

test('an empty unauthorized response asks the user to sign in and retains its HTTP status', async () => {
  globalThis.fetch = async () => new Response(null, { status: 401 })
  await assert.rejects(apiRequest('/account/me', { retry: false }), (error) => {
    assert.equal(error.status, 401)
    assert.match(error.message, /đăng nhập lại/)
    assert.doesNotMatch(error.message, /dữ liệu không hợp lệ/)
    return true
  })
})

test('choosing an in-memory login does not persist credentials, including after refresh', () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  const values = new Map()
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) } })
  try {
    setAuthSession({ access_token: 'saved', refresh_token: 'saved-refresh' })
    assert.equal(values.size, 1)
    setAuthSession({ access_token: 'temporary', refresh_token: 'temporary-refresh' }, { persist: false })
    assert.equal(values.size, 0)
    assert.equal(getAuthSession().accessToken, 'temporary')
    setAuthSession({ ...getAuthSession(), accessToken: 'refreshed-temporary' })
    assert.equal(values.size, 0)
    assert.equal(getAuthSession().accessToken, 'refreshed-temporary')
  } finally {
    clearAuthSession()
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage)
    else delete globalThis.sessionStorage
  }
})

test('a refresh completing after logout cannot restore the old session', async () => {
  let finishRefresh
  globalThis.fetch = async (url) => {
    if (url.endsWith('/auth/refresh-token')) return new Promise((resolve) => { finishRefresh = () => resolve(jsonResponse(200, { success: true, value: 'late-access' })) })
    return jsonResponse(401, { success: false, message: 'Expired' })
  }
  setAuthSession({ access_token: 'old', refresh_token: 'old-refresh' })
  const request = apiRequest('/account/me')
  await new Promise(setImmediate)
  assert.equal(typeof finishRefresh, 'function')
  clearAuthSession()
  finishRefresh()
  await assert.rejects(request, /Phiên đăng nhập đã thay đổi/)
  assert.equal(getAuthSession(), null)
})

test('concurrent 401 responses share one token refresh', async () => {
  let refreshes = 0
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/auth/refresh-token')) { refreshes++; return jsonResponse(200, { success: true, value: 'fresh' }) }
    return options.headers.Authorization === 'Bearer fresh' ? jsonResponse(200, { success: true, value: { name: 'Người chơi' } }) : jsonResponse(401, { success: false, message: 'Expired' })
  }
  setAuthSession({ access_token: 'old', refresh_token: 'refresh' })
  const responses = await Promise.all([apiRequest('/account/me'), apiRequest('/account/me')])
  assert.equal(refreshes, 1)
  assert.equal(responses.length, 2)
})

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

test('API client unwraps the response envelope and sends bearer auth', async () => {
  let called
  globalThis.fetch = async (url, options) => {
    called = { url, options }
    return jsonResponse(200, { success: true, message: null, value: { name: 'An' } })
  }
  setAuthSession({
    access_token: 'access-current',
    refresh_token: 'refresh-current',
    access_exp: 2000000000,
    refresh_exp: 2000003600,
    roles: ['USER'],
  })

  assert.deepEqual(await apiRequest('/account/me'), { name: 'An' })
  assert.equal(called.url, `${API_BASE_URL}/account/me`)
  assert.equal(called.options.headers.Authorization, 'Bearer access-current')
  assert.equal(called.options.headers['ngrok-skip-browser-warning'], 'true')
})

test('API client refreshes expired access token once, then retries the request', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('/account/me') && calls.length === 1) {
      return jsonResponse(401, { success: false, message: 'Access token hết hạn' })
    }
    if (url.endsWith('/auth/refresh-token')) {
      return jsonResponse(200, { success: true, message: null, value: 'access-refreshed' })
    }
    return jsonResponse(200, { success: true, message: null, value: { name: 'Bình' } })
  }
  setAuthSession({
    access_token: 'access-expired',
    refresh_token: 'refresh-valid',
    access_exp: 1,
    refresh_exp: 2000003600,
    roles: ['USER'],
  })

  assert.deepEqual(await apiRequest('/account/me'), { name: 'Bình' })
  assert.equal(calls.length, 3)
  assert.equal(calls[0].options.headers.Authorization, 'Bearer access-expired')
  assert.equal(calls[1].url, `${API_BASE_URL}/auth/refresh-token`)
  assert.equal(calls[1].options.headers.Authorization, 'Bearer access-expired')
  assert.equal(calls[1].options.body, JSON.stringify('refresh-valid'))
  assert.equal(calls[2].options.headers.Authorization, 'Bearer access-refreshed')
  assert.equal(getAuthSession().accessToken, 'access-refreshed')
  assert.equal(getAuthSession().refreshExp, 2000003600)
})

test('API client reports an unsuccessful API envelope as a readable error', async () => {
  globalThis.fetch = async () => jsonResponse(403, {
    success: false,
    message: 'Tài khoản chưa được kích hoạt',
    value: null,
  })

  await assert.rejects(
    apiRequest('/account/me', { auth: false }),
    (error) => error instanceof ApiError &&
      error.status === 403 &&
      error.message === 'Tài khoản chưa được kích hoạt',
  )
})

test('socket authentication refreshes a nearly expired token first and records the new expiry', async () => {
  const nextExpiry = Math.floor(Date.now() / 1000) + 3600
  const jwt = `header.${globalThis.btoa(JSON.stringify({ exp: nextExpiry }))}.signature`
  let refreshes = 0
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `${API_BASE_URL}/auth/refresh-token`)
    assert.equal(options.headers.Authorization, 'Bearer old-token')
    assert.equal(options.body, JSON.stringify('refresh-token'))
    refreshes++
    return jsonResponse(200, { success: true, value: jwt })
  }
  setAuthSession({ access_token: 'old-token', access_exp: Math.floor(Date.now() / 1000) + 5, refresh_token: 'refresh-token' })
  assert.equal(await ensureAccessToken(), jwt)
  assert.equal(getAuthSession().accessExp, nextExpiry)
  assert.equal(await ensureAccessToken(), jwt)
  assert.equal(refreshes, 1)
})

test('forced socket refresh shares the existing REST refresh operation', async () => {
  let refreshes = 0
  globalThis.fetch = async () => { refreshes++; return jsonResponse(200, { success: true, value: 'next-token' }) }
  setAuthSession({ access_token: 'old-token', refresh_token: 'refresh-token' })
  assert.deepEqual(await Promise.all([ensureAccessToken({ forceRefresh: true }), ensureAccessToken({ forceRefresh: true })]), ['next-token', 'next-token'])
  assert.equal(refreshes, 1)
  assert.equal(getAuthSession().accessExp, null, 'an old expiry must not survive a token refresh')
})

test('socket authentication with no session asks for login without making a request', async () => {
  globalThis.fetch = async () => { assert.fail('no HTTP call without a session') }
  await assert.rejects(ensureAccessToken(), (error) => error.status === 401)
})
