import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { API_BASE_URL, clearAuthSession, getAuthSession, setAuthSession } from './client.js'
import { authApi, isSameAuthSession } from './auth.js'

const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })
afterEach(() => clearAuthSession())

test('login sends credentials and optional OTP with the documented request shape', async () => {
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return new Response(JSON.stringify({ success: true, message: null, value: { need_otp: true } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await authApi.login({ identifier: 'player@example.com', password: 'StrongPass9', token: '432187' })
  assert.equal(request.url, `${API_BASE_URL}/auth/login`)
  assert.deepEqual(JSON.parse(request.options.body), {
    identifier: 'player@example.com',
    password: 'StrongPass9',
    token: '432187',
  })
  assert.equal(request.options.headers.Authorization, undefined)
})

test('register uses the required matching-password fields', async () => {
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return new Response(JSON.stringify({ success: true, message: null, value: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await authApi.register({
    name: 'Người chơi',
    username: 'chessplayer',
    email: 'player@example.com',
    password: 'StrongPass9',
    re_password: 'StrongPass9',
  })
  assert.equal(request.url, `${API_BASE_URL}/auth/register`)
  assert.deepEqual(JSON.parse(request.options.body), {
    name: 'Người chơi',
    username: 'chessplayer',
    email: 'player@example.com',
    password: 'StrongPass9',
    re_password: 'StrongPass9',
  })
})

test('OTP request uses the temporary bearer token and the login purpose', async () => {
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return new Response(JSON.stringify({ success: true, message: null, value: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await authApi.requestOtp('temporary-access')
  assert.equal(request.url, `${API_BASE_URL}/account/otp?purpose=LOGIN`)
  assert.equal(request.options.headers.Authorization, 'Bearer temporary-access')
  assert.equal(request.options.body, undefined)
})

test('logout sends this tab refresh token and clears its local session', async () => {
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return new Response(JSON.stringify({ success: true, message: null, value: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  setAuthSession({ access_token: 'access-current', refresh_token: 'refresh-this-tab' })

  await authApi.logout()
  assert.equal(request.url, `${API_BASE_URL}/auth/logout`)
  assert.deepEqual(JSON.parse(request.options.body), { refresh_token: 'refresh-this-tab' })
  assert.equal(request.options.headers.Authorization, 'Bearer access-current')
  assert.equal(getAuthSession(), null)
})

test('a late successful logout cannot clear a newer signed-in session', async () => {
  let finishLogout
  globalThis.fetch = () => new Promise((resolve) => {
    finishLogout = () => resolve(new Response(JSON.stringify({ success: true, value: null }), {
      headers: { 'Content-Type': 'application/json' },
    }))
  })
  setAuthSession({ access_token: 'access-A', refresh_token: 'refresh-A' })
  const logout = authApi.logout()
  setAuthSession({ access_token: 'access-B', refresh_token: 'refresh-B' })
  finishLogout()
  await logout
  assert.equal(getAuthSession().refreshToken, 'refresh-B')
  assert.equal(getAuthSession().accessToken, 'access-B')
})

test('a late failed logout preserves a newer signed-in session and still rejects', async () => {
  let failLogout
  globalThis.fetch = () => new Promise((_resolve, reject) => {
    failLogout = () => reject(new Error('Offline'))
  })
  setAuthSession({ access_token: 'access-A', refresh_token: 'refresh-A' })
  const logout = authApi.logout()
  const rejected = assert.rejects(logout, /Không thể kết nối máy chủ/)
  setAuthSession({ access_token: 'access-B', refresh_token: 'refresh-B' })
  failLogout()
  await rejected
  assert.equal(getAuthSession().refreshToken, 'refresh-B')
  assert.equal(getAuthSession().accessToken, 'access-B')
})

test('a failed logout still clears its own local session', async () => {
  globalThis.fetch = async () => { throw new Error('Offline') }
  setAuthSession({ access_token: 'access-current', refresh_token: 'refresh-current' })
  await assert.rejects(authApi.logout(), /Không thể kết nối máy chủ/)
  assert.equal(getAuthSession(), null)
})

test('logout clears its own session after an access token refresh', async () => {
  let finishLogout
  globalThis.fetch = () => new Promise((resolve) => {
    finishLogout = () => resolve(new Response(JSON.stringify({ success: true, value: null }), {
      headers: { 'Content-Type': 'application/json' },
    }))
  })
  setAuthSession({ access_token: 'access-before-refresh', refresh_token: 'same-refresh' })
  const logout = authApi.logout()
  setAuthSession({ access_token: 'access-after-refresh', refresh_token: 'same-refresh' })
  finishLogout()
  await logout
  assert.equal(getAuthSession(), null)
})

test('session identity uses refresh tokens when present and access tokens otherwise', () => {
  assert.equal(isSameAuthSession({ accessToken: 'old', refreshToken: 'refresh' }, { accessToken: 'new', refreshToken: 'refresh' }), true)
  assert.equal(isSameAuthSession({ accessToken: 'same', refreshToken: 'A' }, { accessToken: 'same', refreshToken: 'B' }), false)
  assert.equal(isSameAuthSession({ accessToken: 'A' }, { accessToken: 'B' }), false)
  assert.equal(isSameAuthSession({ accessToken: 'A' }, { accessToken: 'A' }), true)
  assert.equal(isSameAuthSession({ accessToken: 'A', refreshToken: 'refresh' }, { accessToken: 'A' }), false)
  assert.equal(isSameAuthSession({}, {}), false)
  assert.equal(isSameAuthSession(null, { accessToken: 'A' }), false)
})

test('password recovery encodes the identifier and submits the documented reset fields without bearer auth', async () => {
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options })
    return new Response(JSON.stringify({ success: true, value: null }), { headers: { 'Content-Type': 'application/json' } })
  }
  setAuthSession({ access_token: 'unrelated-session', refresh_token: 'refresh' })
  await authApi.requestPasswordReset('player+chess@example.com')
  await authApi.resetPassword({ token: 'email-token', password: 'NewPass123', re_password: 'NewPass123' })
  assert.equal(requests[0].url, `${API_BASE_URL}/account/forgot-password/player%2Bchess%40example.com`)
  assert.equal(requests[1].url, `${API_BASE_URL}/account/forgot-password`)
  assert.deepEqual(JSON.parse(requests[1].options.body), { token: 'email-token', password: 'NewPass123', re_password: 'NewPass123' })
  assert.equal(requests[1].options.headers.Authorization, undefined)
})
