import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { adminApi, normalizeAdminPage } from './admin.js'
import { ApiError, API_BASE_URL, clearAuthSession, setAuthSession } from './client.js'

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
  clearAuthSession()
})

function json(value, status = 200) {
  return new Response(JSON.stringify({ success: status < 400, value }), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}

function signIn(key = 'one', roles = ['USER']) {
  setAuthSession({ access_token: `access-${key}`, refresh_token: `refresh-${key}`, roles }, { persist: false })
}

const page = (items = []) => ({ items, page: 1, page_size: 20, total_items: items.length, total_pages: items.length ? 1 : 0 })

test('signed-out callers cannot start admin or permission requests', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; return json(true) }
  await assert.rejects(adminApi.access(), (error) => error instanceof ApiError && error.status === 401)
  await assert.rejects(adminApi.accounts(), (error) => error.status === 401)
  await assert.rejects(adminApi.commands(), (error) => error.status === 401)
  assert.equal(calls, 0)
})

test('server denial prevents protected reads even when client roles say ADMIN', async () => {
  signIn('denied', ['ADMIN'])
  const calls = []
  globalThis.fetch = async (url) => { calls.push(url); return json(false) }
  await assert.rejects(adminApi.accounts(), (error) => error.status === 403 && /chưa được cấp quyền/.test(error.message))
  assert.deepEqual(calls, [`${API_BASE_URL}/account/admin-access`])
})

test('parallel admin reads share an in-flight server access check and later reads recheck it', async () => {
  signIn()
  let permissionCalls = 0
  let finishAccess
  const resources = []
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer access-one')
    if (url.endsWith('/account/admin-access')) {
      permissionCalls++
      if (permissionCalls === 1) return new Promise((resolve) => { finishAccess = () => resolve(json(true)) })
      return json(true)
    }
    resources.push(url)
    return json([])
  }
  const roles = adminApi.roles()
  const permissions = adminApi.permissions()
  assert.equal(permissionCalls, 1)
  assert.equal(resources.length, 0)
  finishAccess()
  await Promise.all([roles, permissions])
  assert.equal(resources.length, 2)
  await adminApi.roles()
  assert.equal(permissionCalls, 2)
})

test('malformed server access data never grants administrator access', async () => {
  signIn()
  const calls = []
  globalThis.fetch = async (url) => { calls.push(url); return json('true') }
  await assert.rejects(adminApi.roles(), /quyền quản trị không hợp lệ/)
  assert.equal(calls.length, 1)
})

test('a session change while checking access prevents a protected read with the new session', async () => {
  signIn('old')
  let finishAccess
  const calls = []
  globalThis.fetch = (url) => {
    calls.push(url)
    return new Promise((resolve) => { finishAccess = () => resolve(json(true)) })
  }
  const pending = adminApi.accounts()
  signIn('new')
  finishAccess()
  await assert.rejects(pending, (error) => error.status === 401 && /đã thay đổi/.test(error.message))
  assert.deepEqual(calls, [`${API_BASE_URL}/account/admin-access`])
})

test('access requests belonging to different sessions do not share a pending result', async () => {
  const pending = []
  globalThis.fetch = (_url, options) => new Promise((resolve) => pending.push({ resolve, token: options.headers.Authorization }))
  signIn('old')
  const old = adminApi.access()
  signIn('new')
  const current = adminApi.access()
  assert.equal(pending.length, 2)
  assert.equal(pending[1].token, 'Bearer access-new')
  pending[0].resolve(json(true))
  pending[1].resolve(json(false))
  await assert.rejects(old, (error) => error.status === 401)
  assert.equal(await current, false)
})

test('a protected response arriving after logout is rejected instead of returning another session data', async () => {
  signIn()
  let finishResource
  globalThis.fetch = async (url) => {
    if (url.endsWith('/account/admin-access')) return json(true)
    return new Promise((resolve) => { finishResource = () => resolve(json(['private-role'])) })
  }
  const pending = adminApi.roles()
  await setImmediate()
  assert.equal(typeof finishResource, 'function')
  clearAuthSession()
  finishResource()
  await assert.rejects(pending, (error) => error.status === 401)
})

test('an access-token refresh within the same session retains the access check and uses the fresh token', async () => {
  signIn()
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, bearer: options.headers.Authorization })
    if (url.endsWith('/auth/refresh-token')) return json('access-refreshed')
    if (url.endsWith('/account/admin-access')) return options.headers.Authorization === 'Bearer access-one' ? json(null, 401) : json(true)
    return json([])
  }
  assert.deepEqual(await adminApi.roles(), [])
  assert.equal(calls.filter((call) => call.url.endsWith('/auth/refresh-token')).length, 1)
  assert.equal(calls.at(-1).bearer, 'Bearer access-refreshed')
})

test('admin query parameters encode search and status while normalizing invalid pagination and capping page size', async () => {
  signIn()
  const urls = []
  globalThis.fetch = async (url) => {
    if (url.endsWith('/account/admin-access')) return json(true)
    urls.push(new URL(url))
    return json(page())
  }
  await adminApi.accounts({ search: '  a+b@example.test &status=BANNED  ', status: 'ACTIVE & extra', page: -5, pageSize: 500 })
  const first = urls[0]
  assert.equal(first.pathname, '/api/admin/accounts')
  assert.equal(first.searchParams.get('search'), 'a+b@example.test &status=BANNED')
  assert.equal(first.searchParams.get('status'), 'ACTIVE & extra')
  assert.equal(first.searchParams.get('page'), '1')
  assert.equal(first.searchParams.get('page_size'), '100')
  await adminApi.journals({ page: 1.5, pageSize: 'invalid' })
  assert.equal(urls[1].searchParams.get('page'), '1')
  assert.equal(urls[1].searchParams.get('page_size'), '20')
})

test('readonly admin wrappers use the documented routes and never request raw session tokens', async () => {
  signIn()
  const paths = []
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url)
    const path = parsed.pathname.replace('/api', '') + parsed.search
    paths.push(path)
    assert.equal(options.method, 'GET')
    assert.equal(options.body, undefined)
    if (path === '/account/admin-access') return json(true)
    if (['/account/commands', '/admin/roles', '/admin/permissions'].includes(path)) return json([])
    if (/^\/admin\/(journals|notifications|blacklist)\?/.test(path)) return json(page())
    return json({ count: 5 })
  }
  await adminApi.commands()
  await adminApi.accountCount({ status: 'ACTIVE' })
  await adminApi.account(42)
  await adminApi.roles()
  await adminApi.permissions()
  await adminApi.journals({ search: 'login', page: 2, pageSize: 5 })
  await adminApi.notifications({ page: 2, pageSize: 10 })
  await adminApi.notificationStats()
  await adminApi.tokenStats()
  await adminApi.blacklist()
  assert.deepEqual(paths.filter((path) => path !== '/account/admin-access'), [
    '/account/commands', '/admin/accounts/count?status=ACTIVE', '/admin/accounts/42', '/admin/roles', '/admin/permissions',
    '/admin/journals?search=login&page=2&page_size=5', '/admin/notifications?page=2&page_size=10',
    '/admin/notifications/stats', '/admin/tokens/stats', '/admin/blacklist?page=1&page_size=20',
  ])
  assert.equal(paths.includes('/admin/tokens'), false)
  const callsBeforeInvalid = paths.length
  await assert.rejects(adminApi.account('../roles'), TypeError)
  await assert.rejects(adminApi.account(0), TypeError)
  assert.equal(paths.length, callsBeforeInvalid)
})

test('pagination keeps unknown counts unknown and rejects malformed list responses', () => {
  const items = [{ account_id: 4 }]
  assert.deepEqual(normalizeAdminPage({ items }), { items, page: null, pageSize: null, totalItems: null, totalPages: null })
  assert.deepEqual(normalizeAdminPage(page()), { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 })
  assert.throws(() => normalizeAdminPage({ total_items: 0 }), ApiError)
  assert.throws(() => normalizeAdminPage(null), ApiError)
})
