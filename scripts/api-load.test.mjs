import assert from 'node:assert/strict'
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { compareLoadSnapshots, runLoadTest, summarizeLoadSamples } from './api-load.mjs'

test('load statistics distinguish HTTP, application, and transport failures', () => {
  const samples = [
    { status: 200, success: true, ms: 100, bytes: 50, concurrencyAtStart: 1, startedAt: '2026-11-21T00:00:00.000Z' },
    { status: 200, success: false, ms: 200, bytes: 10, concurrencyAtStart: 2, startedAt: '2026-11-21T00:00:00.100Z' },
    { status: 503, success: false, ms: 300, bytes: 5, concurrencyAtStart: 2, startedAt: '2026-11-21T00:00:00.200Z' },
    { status: 0, success: false, ms: 10000, bytes: 0, error: 'TimeoutError', concurrencyAtStart: 1, startedAt: '2026-11-21T00:00:00.300Z' },
  ]
  const summary = summarizeLoadSamples(samples, 1000)
  assert.equal(summary.attempted, 4)
  assert.equal(summary.completed, 3)
  assert.equal(summary.successful, 1)
  assert.equal(summary.httpErrors, 1)
  assert.equal(summary.applicationErrors, 1)
  assert.equal(summary.transportErrors, 1)
  assert.equal(summary.timeouts, 1)
  assert.equal(summary.completedRps, 3)
  assert.equal(summary.successfulRps, 1)
  assert.equal(summary.peakConcurrency, 2)
  assert.equal(summary.p50Ms, 200)
  assert.equal(summary.p95Ms, 300)
  assert.equal(summary.bytes, 65)
})

test('before and after deltas retain sign and do not divide by zero or invent missing metrics', () => {
  const changes = compareLoadSnapshots({ p50Ms: 100, p95Ms: 200, maxMs: 0 }, { p50Ms: 120, p95Ms: 150, maxMs: 1 })
  assert.deepEqual(changes.p50Ms, { before: 100, after: 120, delta: 20, percent: 20 })
  assert.deepEqual(changes.p95Ms, { before: 200, after: 150, delta: -50, percent: -25 })
  assert.equal(changes.maxMs.percent, null)
  assert.equal(changes.p99Ms, null)
})

test('empty load samples report zero traffic and no invented latency', () => {
  const summary = summarizeLoadSamples([], 0)
  assert.equal(summary.attempted, 0)
  assert.equal(summary.p95Ms, null)
  assert.equal(summary.completedRps, null)
  assert.equal(summary.peakConcurrency, 0)
})

test('load runner stops on rate limiting without trying another account or disclosing its password', async () => {
  const originalFetch = globalThis.fetch
  const folder = await mkdtemp(join(tmpdir(), 'chess-load-stop-'))
  let requests = 0
  globalThis.fetch = async (url) => {
    requests++
    assert.equal(url, 'https://thesaurus-divinity-cosigner.ngrok-free.dev/api/auth/login')
    return new Response(JSON.stringify({ success: false, message: 'Too many requests' }), {
      status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
    })
  }
  try {
    const report = await runLoadTest({ password: 'unit-only-private-password', outputDir: folder })
    assert.equal(requests, 1)
    assert.equal(report.requestCount, 1)
    assert.match(report.stopReason, /429/)
    assert.equal(report.recoveryAttempted, false)
    assert.equal(report.stages.length, 0)
    assert.equal(report.after, null)
    const saved = await readFile(join(folder, 'load-results.json'), 'utf8')
    assert.doesNotMatch(saved, /unit-only-private-password|Authorization/)
  } finally {
    globalThis.fetch = originalFetch
    await unlink(join(folder, 'load-results.json')).catch(() => {})
    await rmdir(folder)
  }
})

test('load recovery honors Retry-After, preserves the interrupted phase, and logs out its original session', async () => {
  const originalFetch = globalThis.fetch
  const folder = await mkdtemp(join(tmpdir(), 'chess-load-recovery-'))
  const calls = []
  let earliestRecovery = 0
  const token = Buffer.from('{"alg":"HS256"}').toString('base64url') + '.' + Buffer.from('{"uid":"mock-user"}').toString('base64url') + '.test-signature'
  globalThis.fetch = async (url) => {
    calls.push(new URL(url).pathname)
    if (calls.length === 1) return new Response(JSON.stringify({ success: true, value: { access_token: token, refresh_token: 'mock-refresh', roles: ['USER'] } }))
    if (calls.length === 2) return new Response(JSON.stringify({ success: true, value: { name: 'Mock user' } }))
    if (calls.length === 3) {
      earliestRecovery = Date.now() + 50
      return new Response(JSON.stringify({ success: false }), { status: 429, headers: { 'Retry-After': '0.05' } })
    }
    assert.ok(Date.now() >= earliestRecovery, 'No recovery request may precede Retry-After')
    if (calls.length === 4) return new Response(JSON.stringify({ success: true, value: { name: 'Mock user' } }))
    assert.equal(calls.length, 5)
    return new Response(JSON.stringify({ success: true, value: null }))
  }
  try {
    const report = await runLoadTest({ password: 'mock-password', outputDir: folder })
    assert.deepEqual(calls, ['/api/auth/login', '/api/account/me', '/api/auth/login', '/api/account/me', '/api/auth/logout'])
    assert.match(report.stopReason, /429 during login/)
    assert.equal(report.recovery.healthy, true)
    assert.equal(report.recoveryAttempted, true)
    assert.equal(report.cleanupComplete, true)
    assert.equal(report.stages.length, 0)
    assert.equal(report.beforeAfterComparable, false)
  } finally {
    globalThis.fetch = originalFetch
    await unlink(join(folder, 'load-results.json')).catch(() => {})
    await rmdir(folder)
  }
})

test('load runner skips recovery and cleanup when Retry-After exceeds its bounded wait', async () => {
  const originalFetch = globalThis.fetch
  const folder = await mkdtemp(join(tmpdir(), 'chess-load-long-limit-'))
  let calls = 0
  const token = 'header.' + Buffer.from('{"uid":"mock-user"}').toString('base64url') + '.signature'
  globalThis.fetch = async () => {
    calls++
    if (calls === 1) return new Response(JSON.stringify({ success: true, value: { access_token: token, refresh_token: 'mock-refresh' } }))
    if (calls === 2) return new Response(JSON.stringify({ success: true, value: { name: 'Mock user' } }))
    assert.equal(calls, 3, 'No request may ignore the long Retry-After')
    return new Response(JSON.stringify({ success: false }), { status: 429, headers: { 'Retry-After': '120' } })
  }
  try {
    const report = await runLoadTest({ password: 'mock-password', outputDir: folder })
    assert.equal(calls, 3)
    assert.equal(report.recoveryAttempted, false)
    assert.match(report.recovery.reason, /exceeds/)
    assert.equal(report.cleanup[0].logoutAccepted, false)
    assert.equal(report.cleanup[0].status, null)
    assert.equal(report.cleanupComplete, false)
  } finally {
    globalThis.fetch = originalFetch
    await unlink(join(folder, 'load-results.json')).catch(() => {})
    await rmdir(folder)
  }
})
