import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { randomUUID } from 'node:crypto'

const APPROVED_API = 'https://thesaurus-divinity-cosigner.ngrok-free.dev/api'
const SAFE_HEADERS = ['date', 'content-type', 'cache-control', 'pragma', 'expires', 'retry-after', 'ratelimit-limit', 'ratelimit-remaining', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'access-control-allow-origin', 'access-control-allow-credentials', 'strict-transport-security', 'x-content-type-options', 'content-security-policy', 'x-frame-options', 'referrer-policy']
const unwrap = (data) => data && Object.hasOwn(data, 'value') ? data.value : data
const accepted = (response) => response.status >= 200 && response.status < 300 && response.data?.success !== false
const denied = (response) => [401, 403].includes(response.status)
const percentile = (values, p) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1] : null
export const isAuthenticatedLogin = (response) => accepted(response) &&
  typeof response.value?.access_token === 'string' && Boolean(response.value.access_token) &&
  typeof response.value?.refresh_token === 'string' && Boolean(response.value.refresh_token) &&
  !response.value.need_otp && !response.value.need_active

export function sanitizeAuditErrorMessage(value, sensitiveValues = []) {
  if (typeof value !== 'string') return null
  let text = value
  for (const secret of sensitiveValues) {
    if (typeof secret === 'string' && secret) {
      for (const variant of new Set([secret, encodeURIComponent(secret), JSON.stringify(secret).slice(1, -1)])) {
        text = text.split(variant).join('[REDACTED]')
      }
    }
  }
  return text
    .replace(/Bearer\s+[^\s"'<>]+/gi, 'Bearer [REDACTED]')
    .replace(/\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\b/g, '[REDACTED_TOKEN]')
    .replace(/\b[A-Za-z0-9_+\/-]{24,}={0,2}\b/g, '[REDACTED_VALUE]')
    .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g, '[REDACTED_EMAIL]')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .slice(0, 240)
}

export function loginProtectionEvidence(response) {
  if ([423, 429].includes(response.status)) return `HTTP ${response.status}`
  if (![200, 400, 401, 403, 422].includes(response.status)) return null
  const message = typeof response.data?.message === 'string'
    ? response.data.message.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase() : ''
  const explicitMessage = /\b(?:locked|lockout|blocked|too many|rate[ -]?limit|throttl\w*|captcha|try again later)\b|tam\s+khoa|bi\s+khoa|khoa\s+tam|bi\s+chan|qua\s+nhieu|thu\s+lai\s+sau/.test(message)
  if (response.value?.need_otp) return 'OTP required'
  if (response.value?.need_captcha) return 'CAPTCHA required'
  return explicitMessage ? 'Explicit lock/throttle/challenge message' : null
}
const jwt = (token) => {
  try { const [h, p] = token.split('.'); return { header: JSON.parse(Buffer.from(h, 'base64url')), payload: JSON.parse(Buffer.from(p, 'base64url')) } } catch { return null }
}

// Deliberately restricted to the API and disposable accounts supplied by the owner.
// Passwords, bearer values, refresh values, JWT subject IDs, and profile bodies are never recorded.
export async function runSecurityAudit({ password, outputDir = 'docs/security', onProgress = () => {} } = {}) {
  if (!password) throw new Error('Supply CHESS_AUDIT_PASSWORD at runtime; never save it in this file.')
  const report = {
    startedAt: new Date().toISOString(), target: APPROVED_API,
    limits: { remoteRequests: 200, cleanupReserveMin: 10, concurrency: 3, maxRequestsPerSecond: 4, failedLogins: 6, loadRequests: 48, timeoutMs: 10000 },
    checks: [], requests: [], load: [], tokenMetadata: {}, sessions: {},
    exclusions: ['No destructive writes, OTP/email sending, account/password/role changes, token listing, or third-party targets.', 'No backend source or server metrics available.', 'Internal JWT signing-key rotation across midnight and valid-but-expired signatures require backend evidence or a controlled backend clock. Daily user reauthentication is not a requirement.', 'Account names do not establish privileges; granted roles and the admin-access response are recorded before authorization conclusions.'],
  }
  const sessions = new Map()
  const createdSessions = []
  const registeredRefreshTokens = new Set()
  const sensitiveValues = new Set([password])
  const inFlight = new Set()
  let startGate = Promise.resolve()
  let reservations = 0
  let nextStart = 0
  let active = 0
  let peakConcurrency = 0
  let consecutive5xx = 0
  let slowLoadResponses = 0
  let stopReason = ''
  const check = (id, status, detail, evidence = [], severity = 'info') => report.checks.push({ id, status, severity, detail, evidence })
  function registerLoginSession(label, body, response) {
    const value = response.value
    for (const key of ['access_token', 'refresh_token']) {
      if (typeof value?.[key] === 'string') sensitiveValues.add(value[key])
    }
    if (typeof value?.access_token !== 'string' || !value.access_token ||
        typeof value?.refresh_token !== 'string' || !value.refresh_token ||
        registeredRefreshTokens.has(value.refresh_token)) return
    const identifier = typeof body?.identifier === 'string' ? body.identifier : ''
    const user = /^admin(?:[0-9]|[1-4][0-9])$/.test(identifier) ? identifier : 'unexpected-login'
    const prefix = `login-${user}-`
    const suffix = label.startsWith(prefix) ? label.slice(prefix.length) : label
    registeredRefreshTokens.add(value.refresh_token)
    createdSessions.push({ user, suffix, session: value })
  }
  async function request(label, path, { method = 'GET', body, token, headers = {}, cleanup = false } = {}) {
    if (stopReason && !cleanup) throw new Error(stopReason)
    const cleanupReserve = Math.max(10, createdSessions.length * 2 + 1)
    const limit = cleanup ? 200 : 200 - cleanupReserve
    if (report.requests.length + reservations >= limit) throw new Error('Request budget exhausted; cleanup capacity reserved')
    reservations++ // Reserve synchronously before the first await, including queued requests.
    let reservationHeld = true
    let releaseStart
    const previousStart = startGate
    startGate = new Promise((resolveStart) => { releaseStart = resolveStart })
    let entry
    let start
    let completion
    let complete
    try {
      await previousStart
      try {
        if (stopReason && !cleanup) throw new Error(stopReason)
        while (active >= 3) await Promise.race(inFlight)
        await delay(Math.max(0, nextStart - Date.now()))
        if (stopReason && !cleanup) throw new Error(stopReason)
        nextStart = Date.now() + 250
        entry = { label, path, method, startedAt: new Date().toISOString(), status: 0, ms: 0, bytes: 0, headers: {} }
        report.requests.push(entry)
        reservations--
        reservationHeld = false
        active++
        entry.concurrencyAtStart = active
        peakConcurrency = Math.max(peakConcurrency, active)
        start = performance.now()
        completion = new Promise((resolveComplete) => { complete = resolveComplete })
        inFlight.add(completion)
      } finally {
        releaseStart()
      }
      if (path === '/auth/login' && typeof body?.password === 'string') sensitiveValues.add(body.password)
      const res = await fetch(APPROVED_API + path, {
        method, redirect: 'manual', signal: AbortSignal.timeout(10000),
        headers: { Accept: 'application/json', 'ngrok-skip-browser-warning': 'true', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        body: body === undefined ? undefined : typeof body === 'object' && body?.raw !== undefined ? body.raw : JSON.stringify(body),
      })
      const raw = await res.text()
      let data
      try { data = JSON.parse(raw) } catch { data = null }
      entry.status = res.status
      entry.bytes = Buffer.byteLength(raw)
      entry.success = typeof data?.success === 'boolean' ? data.success : null
      entry.headers = Object.fromEntries(SAFE_HEADERS.filter((key) => res.headers.has(key)).map((key) => [key, res.headers.get(key)]))
      entry.setCookiePresent = res.headers.has('set-cookie')
      const response = { status: res.status, data, value: unwrap(data), entry }
      if (path === '/auth/login') {
        registerLoginSession(label, body, response)
        if (!isAuthenticatedLogin(response)) entry.errorMessage = sanitizeAuditErrorMessage(data?.message, sensitiveValues)
        entry.loginOutcome = isAuthenticatedLogin(response) ? 'authenticated' : response.value?.need_otp ? 'otp-required' : response.value?.need_active ? 'activation-required' : 'not-authenticated'
        entry.protectionEvidence = loginProtectionEvidence(response)
      }
      consecutive5xx = res.status >= 500 ? consecutive5xx + 1 : 0
      if ([429, 503].includes(res.status) || consecutive5xx >= 3) stopReason = `Stopped after HTTP ${res.status} (${label})`
      return response
    } catch (error) {
      if (entry) {
        entry.error = error.name
        stopReason = 'Stopped after a transport error or timeout'
      }
      throw error
    } finally {
      if (reservationHeld) reservations--
      if (entry) {
        entry.ms = Math.round(performance.now() - start)
        if (label.startsWith('load-') && entry.ms > 5000 && ++slowLoadResponses >= 2) {
          stopReason ||= 'Load stopped after two responses exceeded 5 seconds'
        }
        active--
        inFlight.delete(completion)
        complete()
      }
    }
  }
  async function login(user, suffix = 'baseline', suppliedPassword = password) {
    const label = `login-${user}-${suffix}`
    const res = await request(label, '/auth/login', { method: 'POST', body: { identifier: user, password: suppliedPassword } })
    if (isAuthenticatedLogin(res)) {
      sessions.set(user, res.value)
    }
    return res
  }
  const refresh = (label, session, refreshToken = session.refresh_token, cleanup = false) => request(label, '/auth/refresh-token', { method: 'POST', token: session.access_token, body: refreshToken, cleanup })
  try {
    onProgress('Checking public contracts and unauthenticated guards')
    const docs = await request('api-docs', '/dev')
    check('documentation', docs.status === 200 ? 'pass' : 'fail', 'API documentation reachable', ['api-docs'])
    const providers = await request('public-providers', '/oauth/providers')
    for (const path of ['/account/me', '/account/admin-access', '/admin/accounts?page=1&page_size=1', '/admin/roles', '/admin/permissions', '/admin/tokens/stats']) {
      const label = `no-token:${path}`
      const res = await request(label, path)
      check(label, denied(res) ? 'pass' : 'fail', 'Protected read must reject anonymous callers', [label], 'high')
    }
    onProgress('Signing in three supplied disposable accounts and observing their actual roles')
    for (const user of ['admin0', 'admin48', 'admin49']) {
      const res = await login(user)
      const full = isAuthenticatedLogin(res)
      report.sessions[user] = { authenticated: full, roles: res.value?.roles || [], needsOtp: Boolean(res.value?.need_otp), needsActivation: Boolean(res.value?.need_active) }
      check(`valid-login:${user}`, full ? 'pass' : res.value?.need_otp || res.value?.need_active ? 'unverified' : 'fail', 'Credentials should establish a full session or explicitly request OTP/activation; incomplete sessions cannot support authenticated checks', [res.entry.label], 'high')
    }
    const session = sessions.get('admin0')
    if (!session) throw new Error('No full admin0 session; authenticated checks cannot continue')
    const decoded = jwt(session.access_token)
    const now = Math.floor(Date.now() / 1000)
    report.tokenMetadata = {
      algorithm: decoded?.header.alg, type: decoded?.header.typ, hasKeyId: Boolean(decoded?.header.kid), claimNames: Object.keys(decoded?.payload || {}),
      accessExpiry: session.access_exp || decoded?.payload.exp, refreshExpiry: session.refresh_exp,
      remainingAccessSeconds: (session.access_exp || decoded?.payload.exp || now) - now,
      remainingRefreshSeconds: session.refresh_exp ? session.refresh_exp - now : null,
      issuedAt: decoded?.payload.iat || null,
    }
    check('internal-key-rotation', 'unverified', 'Owner clarified that the internal JWT signing secret changes on a new calendar day; this does not require daily user reauthentication. The observed HS256 token is signed, not encrypted. Actual rotation and secret protection require backend evidence; token TTL alone cannot prove them and rotation alone does not prove absence of key leakage.')
    const baselineReads = new Map()
    let adminAccess = null
    report.authorization = { roles: Array.isArray(session.roles) ? session.roles : [], adminAccess: null }
    for (const path of ['/account/me', '/account/admin-access', '/admin/accounts/count', '/admin/roles', '/admin/permissions', '/admin/tokens/stats', '/admin/accounts?page=1&page_size=1']) {
      const label = `admin-read:${path}`
      const res = await request(label, path, { token: session.access_token })
      baselineReads.set(path, res)
      if (path === '/account/me') {
        check(label, accepted(res) && res.value && typeof res.value === 'object' ? 'pass' : 'fail', 'Authenticated account must be able to read its own profile', [label], 'medium')
      } else if (path === '/account/admin-access') {
        if (accepted(res) && typeof res.value === 'boolean') {
          adminAccess = res.value
          report.authorization.adminAccess = adminAccess
          check(label, 'pass', `Server reports admin-access=${adminAccess}; account naming is not evidence of administrator privileges`, [label])
        } else check(label, 'unverified', 'Could not establish the server admin-access flag from a boolean response', [label])
      } else if (adminAccess === false) {
        check(label, res.status === 403 ? 'pass' : accepted(res) ? 'fail' : 'unverified', res.status === 403
          ? 'Account with admin-access=false was denied this protected admin read'
          : accepted(res) ? 'Account with admin-access=false received a successful admin read; investigate returned scope before claiming a privilege escalation'
            : 'Expected admin denial could not be distinguished from an unrelated response', [label], accepted(res) ? 'high' : 'info')
      } else if (adminAccess === true) {
        check(label, accepted(res) ? 'pass' : denied(res) ? 'observation' : 'fail', 'Server grants admin access; individual read permissions may still legitimately be denied', [label], 'medium')
      } else check(label, 'unverified', 'Observed response without an established server admin-access flag; no admin privilege claim made', [label])
    }
    onProgress('Testing JWT signature rejection, refresh binding, and input validation')
    const pieces = session.access_token.split('.')
    const ownProfile = baselineReads.get('/account/me')
    const ownProfileVerified = ownProfile?.status === 200 && accepted(ownProfile) && ownProfile.value && typeof ownProfile.value === 'object'
    if (decoded && pieces.length === 3 && ownProfileVerified) {
      const encoded = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
      const tokens = {
        'jwt-unsigned': `${encoded({ alg: 'none', typ: 'JWT' })}.${pieces[1]}.`,
        'jwt-altered-claims': `${pieces[0]}.${encoded({ ...decoded.payload, roles: ['ADMIN', 'SUPERADMIN'], exp: now + 86400 })}.${pieces[2]}`,
        'jwt-invalid-signature': `${pieces[0]}.${pieces[1]}.${(pieces[2][0] === 'a' ? 'b' : 'a') + pieces[2].slice(1)}`,
      }
      for (const [label, token] of Object.entries(tokens)) {
        const res = await request(label, '/account/me', { token })
        check(label, denied(res) ? 'pass' : accepted(res) ? 'fail' : 'unverified', 'Modified or unsigned JWT must be rejected on the same own-profile route whose genuine-token baseline returned 200', [ownProfile.entry.label, label], 'high')
      }
    } else check('jwt-negative', 'unverified', 'JWT checks require both a decodable three-part JWT and a successful genuine-token own-profile baseline')
    const other = sessions.get('admin48')
    if (other) {
      const mixed = await refresh('refresh-cross-account', session, other.refresh_token)
      const tokenIssued = accepted(mixed) && typeof mixed.value === 'string' && Boolean(mixed.value)
      check('refresh-account-binding', denied(mixed) ? 'pass' : tokenIssued ? 'observation' : 'unverified', tokenIssued
        ? 'Mixed-account access/refresh pair was accepted. This alone does not demonstrate unauthorized principal access or a high-severity breach; assess the refresh bearer-token contract and returned identity separately'
        : denied(mixed) ? 'Mixed-account access/refresh pair was denied' : 'Mixed-account response did not establish either rejection or issuance of an access token', [mixed.entry.label], tokenIssued ? 'medium' : 'info')
    }
    const fresh = await refresh('refresh-valid', session)
    check('refresh-valid', accepted(fresh) && typeof fresh.value === 'string' ? 'pass' : 'fail', 'Correct session should refresh access token', [fresh.entry.label], 'high')
    const again = await refresh('refresh-reuse-same-value', session)
    check('refresh-reuse', accepted(again) ? 'observation' : denied(again) ? 'pass' : 'fail', accepted(again) ? 'Same refresh token accepted twice; contract returns access only, with no demonstrated refresh rotation/reuse detection' : 'Repeated refresh was rejected', [fresh.entry.label, again.entry.label], 'medium')
    const nonce = `audit${randomUUID().replaceAll('-', '').slice(0, 16)}`
    for (const [label, body] of [
      ['login-invalid-field-types', { identifier: { $ne: null }, password: [] }],
      ['login-sql-negative', { identifier: "' OR '1'='1", password: nonce }],
      ['login-json-operator-string', { identifier: '{"$ne":null}', password: nonce }],
      ['login-missing-fields', {}],
    ]) {
      const res = await request(label, '/auth/login', { method: 'POST', body })
      const unexpectedLogin = isAuthenticatedLogin(res)
      check(label, unexpectedLogin || res.status >= 500 ? 'fail' : [400, 401, 403, 422].includes(res.status) ? 'pass' : 'unverified', 'Small malformed/injection-shaped login must not authenticate or crash; any issued refresh session is registered for cleanup', [label], 'high')
      if (unexpectedLogin) {
        stopReason = `Stopped after unexpected authentication (${label})`
        throw new Error(stopReason)
      }
    }
    const known = await request('exists-owned-admin0', '/account/exists/admin0')
    const unknown = await request('exists-nonexistent-audit', `/account/exists/${nonce}`)
    check('account-enumeration', accepted(known) && accepted(unknown) && known.value === true && unknown.value === false ? 'observation' : 'unverified', 'Public exists endpoint may disclose whether a supplied identifier exists; no account enumeration campaign was performed', [known.entry.label, unknown.entry.label], 'low')
    const cors = await request('cors-untrusted-origin', '/account/me', { method: 'OPTIONS', headers: { Origin: 'https://audit-origin.invalid', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } })
    check('cors-policy', 'observation', `Observed allow-origin=${cors.entry.headers['access-control-allow-origin'] || '(absent)'}, allow-credentials=${cors.entry.headers['access-control-allow-credentials'] || '(absent)'}. Wildcard without credential cookies is not proof of unauthorized reads.`, [cors.entry.label])
    const noStore = report.requests.filter((r) => r.label === 'login-admin0-baseline' || r.label === 'admin-read:/account/me')
    check('sensitive-response-cache', noStore.every((r) => /no-store/i.test(r.headers['cache-control'] || '')) ? 'pass' : 'observation', 'Token and account responses should explicitly disable caching', noStore.map((r) => r.label), 'medium')
    onProgress('Running bounded read load at 1, 2, and 4 requests per second')
    const loadPaths = []
    if (providers.status === 200 && accepted(providers) && providers.data !== null) loadPaths.push('/oauth/providers')
    if (ownProfileVerified) loadPaths.push('/account/me')
    if (!loadPaths.length) check('bounded-load', 'unverified', 'No lightweight read endpoint passed its baseline; no load requests were sent')
    for (const rps of loadPaths.length ? [1, 2, 4] : []) {
      const pending = new Set()
      let interrupted = false
      let scheduled = 0
      let nextLoadStart = performance.now()
      const firstEntryIndex = report.requests.length
      const start = performance.now()
      for (let i = 0; i < 16; i++) {
        await delay(Math.max(0, nextLoadStart - performance.now()))
        if (stopReason) { interrupted = true; break }
        if (pending.size >= 3) await Promise.race(pending)
        if (stopReason) { interrupted = true; break }
        // Schedule relative to now after waiting for capacity; never catch up by bursting.
        nextLoadStart = performance.now() + 1000 / rps
        const path = loadPaths[i % loadPaths.length]
        let task
        scheduled++
        task = request(`load-${rps}rps-${i + 1}`, path, { token: path === '/account/me' ? session.access_token : undefined }).then((res) => {
          if (res.status !== 200 || res.data?.success === false) interrupted = true
        }).catch(() => { interrupted = true }).finally(() => pending.delete(task))
        pending.add(task)
      }
      await Promise.allSettled(pending)
      const durationMs = Math.round(performance.now() - start)
      const entries = report.requests.slice(firstEntryIndex).filter((r) => r.label.startsWith(`load-${rps}rps-`))
      const completed = entries.filter((r) => r.status > 0)
      const startedTimes = entries.map((r) => Date.parse(r.startedAt)).sort((a, b) => a - b)
      const startSpanMs = startedTimes.length > 1 ? startedTimes.at(-1) - startedTimes[0] : 0
      report.load.push({
        offeredRps: rps, paths: loadPaths, scheduled, attempted: entries.length, completed: completed.length,
        transportErrors: entries.filter((r) => r.error).length,
        timeouts: entries.filter((r) => ['TimeoutError', 'AbortError'].includes(r.error)).length,
        cancelledBeforeStart: scheduled - entries.length,
        httpErrors: completed.filter((r) => r.status >= 400).length,
        applicationErrors: completed.filter((r) => r.success === false).length,
        actualThroughputRps: durationMs ? Number((completed.length * 1000 / durationMs).toFixed(3)) : null,
        actualStartRps: startSpanMs ? Number(((entries.length - 1) * 1000 / startSpanMs).toFixed(3)) : null,
        maxActualConcurrency: entries.length ? Math.max(...entries.map((r) => r.concurrencyAtStart)) : 0,
        statusCounts: completed.reduce((counts, r) => ({ ...counts, [r.status]: (counts[r.status] || 0) + 1 }), {}),
        p50Ms: percentile(completed.map((r) => r.ms), .5), p95Ms: percentile(completed.map((r) => r.ms), .95),
        maxMs: completed.length ? Math.max(...completed.map((r) => r.ms)) : null,
        latencyDefinition: 'Request start through full response body for completed HTTP responses; transport errors/timeouts counted separately',
        durationMs, interrupted: interrupted || Boolean(stopReason),
      })
      if (interrupted || stopReason) {
        stopReason ||= 'Load stopped after an unexpected response or request cancellation'
        break
      }
    }
    if (loadPaths.length) check('bounded-load', report.load.length === 3 && report.load.every((s) => s.completed === 16 && !s.interrupted && !s.applicationErrors && Object.keys(s.statusCounts).every((code) => code === '200')) ? 'pass' : 'unverified', 'Limited remote reads only, with observed throughput/concurrency; interrupted or incomplete measurement does not establish a capacity failure or support 50-user capacity claims', report.requests.filter((r) => r.label.startsWith('load-')).map((r) => r.label), 'info')
    onProgress('Checking failed-password blocking on isolated admin49')
    let blocked = false
    let stopProbeReason = null
    let unexpectedlyAuthenticated = false
    const failures = []
    const baselineAdmin49 = report.sessions.admin49?.authenticated
    for (let i = 1; baselineAdmin49 && i <= 6; i++) {
      await delay(1000)
      const res = await login('admin49', `wrong-${i}`, `Wrong-${nonce}`)
      failures.push(res.entry.label)
      if (isAuthenticatedLogin(res)) {
        unexpectedlyAuthenticated = true
        stopProbeReason = 'Wrong password unexpectedly established a full session; session registered for cleanup'
        check('wrong-password-authentication', 'fail', stopProbeReason, [res.entry.label], 'high')
        break
      }
      const protection = loginProtectionEvidence(res)
      if (protection) {
        blocked = true
        stopProbeReason = protection
        break
      }
      if (res.status === 403 || ![400, 401, 422].includes(res.status)) {
        stopProbeReason = 'Unexpected response without explicit lock evidence; stopped probing'
        break
      }
    }
    report.bruteForce = { baselineAuthenticated: Boolean(baselineAdmin49), attempts: failures.length, blockObserved: blocked, stopProbeReason, wrongPasswordAuthenticated: unexpectedlyAuthenticated }
    if (!baselineAdmin49) {
      check('login-lockout', 'unverified', 'admin49 baseline was not a full authenticated session; no wrong-password probes were sent')
    } else if (unexpectedlyAuthenticated) {
      check('login-lockout', 'fail', 'Wrong-password authentication prevents a valid lockout conclusion; probing stopped', failures, 'high')
    } else if (blocked) {
      check('login-lockout', 'pass', 'Explicit blocking/challenge evidence observed; stopped immediately. Lock duration, scope, and unlock flow remain unverified', failures, 'medium')
    } else if (stopProbeReason) {
      check('login-lockout', 'unverified', stopProbeReason, failures)
    } else {
      const after = await login('admin49', 'correct-after-six')
      const full = isAuthenticatedLogin(after)
      const protection = loginProtectionEvidence(after)
      report.bruteForce.correctAfterFailures = full
      report.bruteForce.blockObserved = Boolean(protection)
      report.bruteForce.stopProbeReason = protection
      check('login-lockout', full ? 'observation' : protection ? 'pass' : 'unverified', full
        ? 'Six wrong passwords followed by a full correct-password login succeeded: no lock demonstrated at this threshold; higher thresholds and per-IP controls remain unverified'
        : protection ? 'Correct-password attempt received explicit blocking/challenge evidence; duration and unlock flow remain unverified'
          : 'Correct-password login did not complete, without explicit lock evidence; cannot conclude that a lockout occurred', [...failures, after.entry.label], 'medium')
    }
  } catch (error) {
    report.interrupted = error.message
    onProgress(`Audit stopped: ${error.message}`)
  } finally {
    onProgress('Revoking only sessions created by this test')
    for (const { user, suffix, session } of createdSessions) {
      try {
        const logout = await request(`cleanup-logout-${user}-${suffix}`, '/auth/logout', { method: 'POST', token: session.access_token, body: { refresh_token: session.refresh_token }, cleanup: true })
        const replay = await refresh(`cleanup-refresh-replay-${user}-${suffix}`, session, session.refresh_token, true)
        check(`logout-refresh-revocation:${user}-${suffix}`, accepted(logout) && denied(replay) ? 'pass' : 'fail', 'Logout must invalidate the test refresh token', [logout.entry.label, replay.entry.label], 'high')
        if (user === 'admin0') {
          const residual = await request('access-after-logout', '/account/me', { token: session.access_token, cleanup: true })
          check('access-after-logout', accepted(residual) ? 'observation' : denied(residual) ? 'pass' : 'fail', accepted(residual) ? 'Access JWT still works after logout, as documented; residual access lasts until expiry unless server session version/denylist is enforced' : 'Access token rejected after logout', [residual.entry.label], 'medium')
        }
      } catch { check(`cleanup:${user}`, 'unverified', 'Could not confirm cleanup; token values were not saved') }
    }
    sessions.clear()
    createdSessions.length = 0
    registeredRefreshTokens.clear()
    sensitiveValues.clear()
    report.completedAt = new Date().toISOString()
    report.requestCount = report.requests.length
    report.peakConcurrency = peakConcurrency
    report.stopReason = stopReason || null
    report.summary = report.checks.reduce((summary, item) => ({ ...summary, [item.status]: (summary[item.status] || 0) + 1 }), {})
    const folder = resolve(outputDir)
    report.outputDir = folder
    await mkdir(folder, { recursive: true })
    await writeFile(resolve(folder, 'security-test-results.json'), JSON.stringify(report, null, 2) + '\n')
  }
  return report
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const outputDir = resolve('docs/security/runs', new Date().toISOString().replace(/[:.]/g, '-'))
  const report = await runSecurityAudit({ password: process.env.CHESS_AUDIT_PASSWORD, outputDir, onProgress: (message) => process.stdout.write(message + '\n') })
  process.stdout.write(JSON.stringify({ summary: report.summary, requestCount: report.requestCount, outputDir: report.outputDir, load: report.load, interrupted: report.interrupted }, null, 2) + '\n')
  if (report.summary.fail || report.interrupted) process.exitCode = 1
}
