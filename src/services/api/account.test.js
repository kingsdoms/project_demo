import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { accountApi } from './account.js'
import { clearAuthSession, setAuthSession } from './client.js'

const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })
afterEach(() => clearAuthSession())
const response = (name) => new Response(JSON.stringify({ success: true, value: { name } }), { headers: { 'Content-Type': 'application/json' } })

test('simultaneous profile requests share one fetch but a later request refreshes the data', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; return response('Người chơi') }
  setAuthSession({ access_token: 'access', refresh_token: 'refresh' })
  const [first, second] = await Promise.all([accountApi.me(), accountApi.me()])
  assert.equal(calls, 1)
  assert.equal(first, second)
  await accountApi.me()
  assert.equal(calls, 2)
})

test('a different signed-in session never shares another session profile response', async () => {
  const pending = []
  globalThis.fetch = (_url, options) => new Promise((resolve) => pending.push({ resolve, token: options.headers.Authorization }))
  setAuthSession({ access_token: 'first', refresh_token: 'refresh-first' })
  const first = accountApi.me()
  setAuthSession({ access_token: 'second', refresh_token: 'refresh-second' })
  const second = accountApi.me()
  assert.equal(pending.length, 2)
  assert.equal(pending[1].token, 'Bearer second')
  pending[0].resolve(response('First'))
  pending[1].resolve(response('Second'))
  assert.equal((await first).name, 'First')
  assert.equal((await second).name, 'Second')
})
