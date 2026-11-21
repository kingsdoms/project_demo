import assert from 'node:assert/strict'
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { isAuthenticatedLogin, loginProtectionEvidence, runSecurityAudit, sanitizeAuditErrorMessage } from './security-audit.mjs'

const loginResponse = (overrides = {}) => ({ status: 200, data: { success: true }, value: { access_token: 'test-access', refresh_token: 'test-refresh' }, ...overrides })

test('audit does not count OTP, activation, or unsuccessful envelopes as a full login', () => {
  assert.equal(isAuthenticatedLogin(loginResponse()), true)
  assert.equal(isAuthenticatedLogin(loginResponse({ value: { access_token: 'temporary', need_otp: true } })), false)
  assert.equal(isAuthenticatedLogin(loginResponse({ value: { access_token: 'temporary', need_active: true } })), false)
  assert.equal(isAuthenticatedLogin(loginResponse({ data: { success: false } })), false)
})

test('audit distinguishes explicit login throttling from ordinary denial and server failure', () => {
  assert.equal(loginProtectionEvidence({ status: 401, data: { message: 'Invalid credentials' } }), null)
  assert.equal(loginProtectionEvidence({ status: 403, data: { message: 'Permission denied' } }), null)
  assert.equal(loginProtectionEvidence({ status: 500, data: { message: 'Too many attempts' } }), null)
  assert.ok(loginProtectionEvidence({ status: 401, data: { message: 'Tài khoản bị khóa tạm thời. Thử lại sau.' } }))
  assert.ok(loginProtectionEvidence({ status: 429 }))
})

test('audit error evidence removes runtime secrets, bearer values, and email addresses', () => {
  const message = sanitizeAuditErrorMessage('Denied test-password, Bearer abc.def.ghi, player@example.test', ['test-password'])
  assert.doesNotMatch(message, /test-password|abc\.def\.ghi|player@example/)
  assert.match(message, /Denied/)
})

test('audit stops API dispatch after 429 and preserves the original response evidence', async () => {
  const originalFetch = globalThis.fetch
  const folder = await mkdtemp(join(tmpdir(), 'chess-security-stop-'))
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(new URL(url).pathname)
    if (url.endsWith('/dev')) return new Response('<html>Documentation</html>', { headers: { 'Content-Type': 'text/html' } })
    assert.ok(url.endsWith('/oauth/providers'), 'No later API request may be sent after rate limiting')
    return new Response(JSON.stringify({ success: false, message: 'Too many requests' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } })
  }
  try {
    const report = await runSecurityAudit({ password: 'disposable-unit-test-secret', outputDir: folder })
    assert.deepEqual(calls, ['/api/dev', '/api/oauth/providers'])
    assert.equal(report.requestCount, 2)
    assert.match(report.stopReason, /429/)
    const saved = JSON.parse(await readFile(join(folder, 'security-test-results.json'), 'utf8'))
    assert.equal(saved.requests[1].headers['retry-after'], '60')
    assert.doesNotMatch(JSON.stringify(saved), /disposable-unit-test-secret/)
  } finally {
    globalThis.fetch = originalFetch
    await unlink(join(folder, 'security-test-results.json')).catch(() => {})
    await rmdir(folder)
  }
})
