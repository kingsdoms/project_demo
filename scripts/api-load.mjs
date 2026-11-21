import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { isAuthenticatedLogin, loginProtectionEvidence, sanitizeAuditErrorMessage } from './security-audit.mjs'

const APPROVED_API = 'https://thesaurus-divinity-cosigner.ngrok-free.dev/api'
const LIMITS = Object.freeze({
  totalRequests: 10_000,
  cleanupReserve: 55,
  maxUsers: 50,
  stageUsers: [1, 5, 10, 25, 50],
  stageDurationMs: 8_000,
  stageRequestLimit: 3_000,
  snapshotRequests: 20,
  setupStartIntervalMs: 500,
  snapshotStartIntervalMs: 250,
  cleanupStartIntervalMs: 500,
  timeoutMs: 10_000,
  slowThresholdMs: 5_000,
  rateLimitFallbackMs: 60_000,
  maxRecoveryWaitMs: 60_000,
})
const unwrap = (data) => data && Object.hasOwn(data, 'value') ? data.value : data
const successful = (response) => response.status === 200 && response.data?.success !== false && response.data !== null
const rounded = (value) => Number(value.toFixed(3))
const percentile = (values, ratio) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * ratio) - 1] : null

export function summarizeLoadSamples(samples, durationMs) {
  const completed = samples.filter((sample) => sample.status > 0)
  const values = completed.map((sample) => sample.ms)
  const starts = samples.map((sample) => Date.parse(sample.startedAt)).sort((a, b) => a - b)
  const span = starts.length > 1 ? starts.at(-1) - starts[0] : 0
  return {
    attempted: samples.length,
    completed: completed.length,
    successful: completed.filter((sample) => sample.status === 200 && sample.success === true).length,
    httpErrors: completed.filter((sample) => sample.status >= 400).length,
    applicationErrors: completed.filter((sample) => sample.status < 400 && sample.success === false).length,
    transportErrors: samples.filter((sample) => sample.error).length,
    timeouts: samples.filter((sample) => ['TimeoutError', 'AbortError'].includes(sample.error)).length,
    statusCounts: completed.reduce((counts, sample) => ({ ...counts, [sample.status]: (counts[sample.status] || 0) + 1 }), {}),
    durationMs: Math.round(durationMs),
    completedRps: durationMs > 0 ? rounded(completed.length * 1000 / durationMs) : null,
    successfulRps: durationMs > 0 ? rounded(completed.filter((sample) => sample.status === 200 && sample.success === true).length * 1000 / durationMs) : null,
    requestStartRps: span > 0 ? rounded((samples.length - 1) * 1000 / span) : null,
    peakConcurrency: samples.length ? Math.max(...samples.map((sample) => sample.concurrencyAtStart || 0)) : 0,
    p50Ms: percentile(values, .5),
    p95Ms: percentile(values, .95),
    p99Ms: percentile(values, .99),
    maxMs: values.length ? Math.max(...values) : null,
    bytes: completed.reduce((sum, sample) => sum + sample.bytes, 0),
  }
}

export function compareLoadSnapshots(before, after) {
  const result = {}
  for (const key of ['p50Ms', 'p95Ms', 'p99Ms', 'maxMs', 'completedRps', 'successfulRps']) {
    const previous = before?.[key]
    const current = after?.[key]
    result[key] = typeof previous === 'number' && typeof current === 'number'
      ? { before: previous, after: current, delta: rounded(current - previous), percent: previous ? rounded((current - previous) / previous * 100) : null }
      : null
  }
  return result
}

function retryAfterTimestamp(value) {
  if (!value) return 0
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Date.now() + seconds * 1000
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

// Live traffic is available only through this explicit runner, outside Node's test discovery pattern.
// A virtual user retains one supplied account and waits for each full body before its next read.
export async function runLoadTest({ password, outputDir, onProgress = () => {} } = {}) {
  if (typeof password !== 'string' || !password) throw new Error('Supply CHESS_AUDIT_PASSWORD only at runtime.')
  const folder = resolve(outputDir || 'docs/security/load-runs/' + new Date().toISOString().replace(/[:.]/g, '-'))
  const report = {
    schemaVersion: 1,
    startedAt: new Date().toISOString(),
    timezone: 'Asia/Bangkok',
    target: APPROVED_API,
    endpoint: '/account/me',
    model: 'Closed loop: one unique supplied account per virtual user; one outstanding request per virtual user; no think time during a stage.',
    limits: LIMITS,
    accountSetup: [],
    before: null,
    stages: [],
    after: null,
    comparison: null,
    requests: [],
    cleanup: [],
    limitations: [
      'End-to-end timings include the client, network, ngrok and backend; CPU, memory, DB and pool telemetry are unavailable.',
      'A stage ends at its duration or request/budget limit. Results describe this bounded run, not a maximum capacity or SLA.',
      'The caller supplies only existing test accounts; no account, password, role or content is modified.',
      'No password, access token, refresh token, cookie, JWT subject or raw account body is written to the report.',
      'Actual account privileges are observed at login; an admin-prefixed username does not establish admin authorization.',
    ],
  }
  const sessions = []
  const secrets = new Set([password])
  const authenticatedSubjects = new Set()
  let active = 0
  let peakConcurrency = 0
  let stopReason = null
  let stopKind = null
  let consecutive5xx = 0
  let slowResponses = 0
  let retryAfterUntil = 0
  let rateLimitObserved = false
  let recoveryAttempted = false
  let phaseName = 'setup'

  function stop(reason, kind = 'safety') {
    if (!stopReason) { stopReason = reason; stopKind = kind; onProgress('Stopping new requests: ' + reason) }
  }
  function normalCapacityAvailable() {
    return report.requests.length < LIMITS.totalRequests - LIMITS.cleanupReserve
  }
  async function request({ phase, user = null, vu = null, method = 'GET', body, token, cleanup = false, allowStopped = false }) {
    if (stopReason && !cleanup && !allowStopped) return null
    if (!cleanup && !normalCapacityAvailable()) {
      stop('Total request budget reached; cleanup capacity is reserved', 'budget')
      return null
    }
    if (report.requests.length >= LIMITS.totalRequests) {
      stop('Total request budget exhausted', 'budget')
      return null
    }
    if ((cleanup || allowStopped) && Date.now() < retryAfterUntil) return null
    const path = phase === 'login' ? '/auth/login' : cleanup ? '/auth/logout' : '/account/me'
    const entry = {
      id: report.requests.length + 1,
      phase, user, vu, method, path,
      startedAt: new Date().toISOString(),
      status: 0, success: false, ms: 0, bytes: 0,
      concurrencyAtStart: ++active,
    }
    // The budget is consumed synchronously before the first await, so workers cannot overshoot it.
    report.requests.push(entry)
    peakConcurrency = Math.max(peakConcurrency, active)
    const start = performance.now()
    try {
      const res = await fetch(APPROVED_API + path, {
        method,
        redirect: 'manual',
        signal: AbortSignal.timeout(LIMITS.timeoutMs),
        headers: {
          Accept: 'application/json', 'ngrok-skip-browser-warning': 'true',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const raw = await res.text()
      let data
      try { data = JSON.parse(raw) } catch { data = null }
      const response = { status: res.status, data, value: unwrap(data), entry }
      entry.status = res.status
      entry.success = successful(response)
      entry.bytes = Buffer.byteLength(raw)
      if (res.headers.has('retry-after')) {
        const until = retryAfterTimestamp(res.headers.get('retry-after'))
        if (until > retryAfterUntil) retryAfterUntil = until
        entry.retryAfterUntil = until ? new Date(until).toISOString() : null
      }
      if (res.status === 429) {
        rateLimitObserved = true
        // Missing/invalid Retry-After never permits an immediate cleanup burst.
        if (!entry.retryAfterUntil || Date.parse(entry.retryAfterUntil) <= Date.now()) {
          retryAfterUntil = Math.max(retryAfterUntil, Date.now() + LIMITS.rateLimitFallbackMs)
          entry.retryAfterUntil = new Date(retryAfterUntil).toISOString()
          entry.retryAfterSource = 'fallback-60-seconds'
        } else entry.retryAfterSource = 'response-header'
      }
      if (!cleanup) {
        consecutive5xx = res.status >= 500 ? consecutive5xx + 1 : 0
        if ([429, 503].includes(res.status)) stop(`HTTP ${res.status} during ${phase}`, 'safety')
        else if (consecutive5xx >= 3) stop('Three consecutive HTTP 5xx responses', 'safety')
      }
      return response
    } catch (error) {
      entry.error = typeof error?.name === 'string' ? error.name : 'Error'
      if (!cleanup) stop('Transport error or timeout during ' + phase, 'safety')
      return { status: 0, data: null, value: null, entry }
    } finally {
      entry.ms = rounded(performance.now() - start)
      active--
      if (!cleanup && entry.ms > LIMITS.slowThresholdMs && ++slowResponses >= 2) {
        stop('Two responses exceeded five seconds', 'safety')
      }
    }
  }

  async function snapshot(name, session, { afterCooldown = false } = {}) {
    phaseName = name
    const startIndex = report.requests.length
    const start = performance.now()
    let nextStart = Date.now()
    for (let index = 0; index < LIMITS.snapshotRequests && (!stopReason || afterCooldown); index++) {
      await delay(Math.max(0, nextStart - Date.now()))
      if (stopReason && !afterCooldown) break
      nextStart = Date.now() + LIMITS.snapshotStartIntervalMs
      const res = await request({ phase: name, user: session.user, token: session.accessToken, allowStopped: afterCooldown })
      if (!res) break
      if (!res.entry.success) {
        if (!stopReason) stop(`Unexpected response HTTP ${res.status} in ${name}`, 'validation')
        break
      }
    }
    const samples = report.requests.slice(startIndex)
    return { user: session.user, endpoint: '/account/me', afterCooldown, ...summarizeLoadSamples(samples, performance.now() - start), complete: samples.length === LIMITS.snapshotRequests && samples.every((sample) => sample.success) }
  }

  try {
    onProgress('Logging in up to 50 supplied test accounts once each; validating each own-profile read')
    let nextLoginStart = Date.now()
    for (let index = 0; index < LIMITS.maxUsers && !stopReason; index++) {
      await delay(Math.max(0, nextLoginStart - Date.now()))
      if (stopReason) break
      nextLoginStart = Date.now() + LIMITS.setupStartIntervalMs
      const user = 'admin' + index
      const login = await request({ phase: 'login', user, method: 'POST', body: { identifier: user, password } })
      if (!login) break
      for (const key of ['access_token', 'refresh_token']) {
        if (typeof login.value?.[key] === 'string' && login.value[key]) secrets.add(login.value[key])
      }
      const full = isAuthenticatedLogin(login)
      const setup = {
        user, status: login.status, authenticated: full, profileValidated: false,
        roles: Array.isArray(login.value?.roles) ? login.value.roles : [],
        needsOtp: Boolean(login.value?.need_otp), needsActivation: Boolean(login.value?.need_active),
      }
      report.accountSetup.push(setup)
      // Track every complete issued session even if the response unexpectedly fails its envelope.
      if (typeof login.value?.access_token === 'string' && login.value.access_token &&
          typeof login.value?.refresh_token === 'string' && login.value.refresh_token) {
        const session = { user, accessToken: login.value.access_token, refreshToken: login.value.refresh_token, usable: false }
        sessions.push(session)
        if (full && !stopReason) {
          let subject = null
          try {
            const claims = JSON.parse(Buffer.from(session.accessToken.split('.')[1], 'base64url').toString('utf8'))
            if (['string', 'number'].includes(typeof claims.uid)) subject = typeof claims.uid + ':' + String(claims.uid)
          } catch { /* Decoding only checks distinct subjects; it does not verify a JWT signature. */ }
          setup.uniqueSubject = subject === null ? null : !authenticatedSubjects.has(subject)
          if (subject !== null) authenticatedSubjects.add(subject)
          const profile = await request({ phase: 'validate', user, token: session.accessToken })
          setup.profileStatus = profile?.status ?? null
          setup.profileValidated = Boolean(profile?.entry.success && profile.value && typeof profile.value === 'object' && !Array.isArray(profile.value))
          session.usable = setup.profileValidated && setup.uniqueSubject === true
          if (!setup.profileValidated && !stopReason) stop('Authenticated profile validation failed for ' + user, 'validation')
          else if (setup.uniqueSubject !== true) setup.skippedReason = subject === null ? 'Distinct JWT subject could not be established; excluded from concurrent users' : 'Duplicate authenticated subject; excluded from concurrent users'
        }
      }
      if (!full) {
        setup.protectionEvidence = loginProtectionEvidence(login)
        setup.errorMessage = sanitizeAuditErrorMessage(login.data?.message, secrets)
        setup.skippedReason = setup.protectionEvidence || (setup.needsOtp ? 'OTP required' : setup.needsActivation ? 'Activation required' : 'No full session; not retried')
      }
    }
    const available = sessions.filter((session) => session.usable)
    report.availableUsers = available.length
    report.requestedUsers = LIMITS.maxUsers
    report.distinctAuthenticatedSubjects = authenticatedSubjects.size
    report.uniqueSubjectCount = authenticatedSubjects.size
    report.subjectProof = 'JWT uid values were compared only in memory and each usable token passed a server own-profile read. No subject value is recorded.'
    if (!available.length && !stopReason) stop('No authenticated account passed its own-profile baseline', 'validation')
    if (!stopReason) {
      onProgress('Measuring 20 sequential reads before load with ' + available[0].user)
      report.before = await snapshot('before', available[0])
    }
    for (const requestedUsers of LIMITS.stageUsers) {
      if (stopReason) break
      const users = available.slice(0, requestedUsers)
      if (!users.length) break
      const stageLabel = 'load-' + requestedUsers
      phaseName = stageLabel
      onProgress(`Starting closed-loop stage: requested ${requestedUsers}, actual ${users.length} users, up to 8 seconds / 3000 reads`)
      const startIndex = report.requests.length
      const start = performance.now()
      const deadline = start + LIMITS.stageDurationMs
      let stageStarts = 0
      const workerStops = new Map()
      await Promise.all(users.map(async (session, index) => {
        while (!stopReason) {
          if (performance.now() >= deadline) { workerStops.set(session.user, 'duration'); break }
          if (stageStarts >= LIMITS.stageRequestLimit) { workerStops.set(session.user, 'stage-request-limit'); break }
          if (!normalCapacityAvailable()) { stop('Total request budget reached; cleanup capacity is reserved', 'budget'); break }
          stageStarts++
          const res = await request({ phase: stageLabel, user: session.user, vu: index + 1, token: session.accessToken })
          if (!res) break
          // Each worker awaits full response completion, keeping its account/token affinity.
          if ([401, 403].includes(res.status)) { stop(`Authenticated read denied with HTTP ${res.status} for ${session.user}`, 'validation'); break }
          if (res.status === 200 && !res.entry.success) { stop('Invalid or unsuccessful own-profile envelope during load', 'validation'); break }
          if (res.status > 0 && res.status < 500 && res.status !== 200) { stop(`Unexpected HTTP ${res.status} own-profile response during load`, 'validation'); break }
        }
      }))
      const durationMs = performance.now() - start
      const samples = report.requests.slice(startIndex)
      const endedBy = stopReason ? stopKind === 'budget' ? 'total-request-budget' : 'safety-or-validation-stop'
        : stageStarts >= LIMITS.stageRequestLimit ? 'stage-request-limit' : 'duration'
      const summary = summarizeLoadSamples(samples, durationMs)
      const perUser = users.map((session, index) => ({
        user: session.user, vu: index + 1,
        ...summarizeLoadSamples(samples.filter((sample) => sample.user === session.user), durationMs),
        peakConcurrency: samples.some((sample) => sample.user === session.user) ? 1 : 0,
        endedBy: workerStops.get(session.user) || (stopReason ? 'global-stop' : endedBy),
      }))
      report.stages.push({ requestedUsers, actualUsers: users.length, durationLimitMs: LIMITS.stageDurationMs, requestLimit: LIMITS.stageRequestLimit, ...summary, endedBy, stopReason, perUser })
      onProgress(`Finished ${requestedUsers}-user stage: ${summary.attempted} reads, ${summary.successful} successful, ${summary.completedRps} completed RPS, p95 ${summary.p95Ms} ms, peak ${summary.peakConcurrency}; ${endedBy}`)
    }
    if (!stopReason && available.length) {
      onProgress('Measuring 20 sequential reads after load with ' + available[0].user)
      report.after = await snapshot('after', available[0])
      report.comparison = compareLoadSnapshots(report.before, report.after)
    } else report.afterSkippedReason = stopReason || 'No usable session'
  } catch (error) {
    report.interrupted = sanitizeAuditErrorMessage(error?.message, secrets) || 'Unexpected local error'
    stop(report.interrupted, 'local-error')
  } finally {
    // Keep the original interrupted-stage reason; recovery never restarts load.
    let cleanupBlockedReason = null
    const originalSession = sessions.find((session) => session.usable && session.user === report.before?.user)
      || sessions.find((session) => session.usable)
    if (rateLimitObserved && sessions.length) {
      const remainingMs = Math.max(0, retryAfterUntil - Date.now())
      report.recovery = { attempted: false, cooldownMs: remainingMs, maxWaitMs: LIMITS.maxRecoveryWaitMs, preservesOriginalStop: true }
      if (!originalSession) {
        cleanupBlockedReason = 'Rate limit active and no validated session is available for one recovery read'
      } else if (remainingMs > LIMITS.maxRecoveryWaitMs) {
        cleanupBlockedReason = 'Retry-After exceeds the single 60-second recovery window; no early request sent'
      } else {
        onProgress('Rate limit observed: waiting once for the cooldown before one recovery read; load remains stopped')
        const waitStart = performance.now()
        while (Date.now() < retryAfterUntil && performance.now() - waitStart < LIMITS.maxRecoveryWaitMs) {
          await delay(Math.min(1000, Math.max(0, retryAfterUntil - Date.now())))
        }
        report.recovery.waitedMs = Math.round(performance.now() - waitStart)
        if (Date.now() < retryAfterUntil) {
          cleanupBlockedReason = 'Cooldown has not elapsed within the bounded recovery wait'
        } else if (!normalCapacityAvailable()) {
          cleanupBlockedReason = 'No normal request budget remains for the recovery read'
        } else {
          recoveryAttempted = true
          report.recovery.attempted = true
          const recovery = await request({ phase: 'recovery', user: originalSession.user, token: originalSession.accessToken, allowStopped: true })
          const healthy = Boolean(recovery?.entry.success && recovery.value && typeof recovery.value === 'object' && !Array.isArray(recovery.value))
          report.recovery.status = recovery?.status ?? null
          report.recovery.healthy = healthy
          if (!healthy) {
            cleanupBlockedReason = 'The single recovery read did not succeed; no further cleanup traffic sent'
          } else if (report.before?.complete && normalCapacityAvailable()) {
            onProgress('Recovery read succeeded: measuring a bounded after-cooldown snapshot on the original account')
            report.after = await snapshot('after-cooldown', originalSession, { afterCooldown: true })
            report.after.measuredAfterCooldown = true
            report.after.originalLoadInterrupted = true
            report.comparison = compareLoadSnapshots(report.before, report.after)
            if (report.after.complete) delete report.afterSkippedReason
            else {
              report.afterSkippedReason = 'After-cooldown snapshot interrupted; not comparable'
              cleanupBlockedReason = 'After-cooldown snapshot failed; no further cleanup traffic sent'
            }
          }
        }
      }
      if (cleanupBlockedReason) {
        report.recovery.reason = cleanupBlockedReason
        report.afterSkippedReason ||= cleanupBlockedReason
      }
    }
    phaseName = 'cleanup'
    onProgress('Cleaning up only sessions created by this load test')
    let nextCleanupStart = Date.now()
    for (const session of sessions) {
      if (cleanupBlockedReason) {
        report.cleanup.push({ user: session.user, status: null, logoutAccepted: false, skippedReason: cleanupBlockedReason })
        continue
      }
      await delay(Math.max(0, nextCleanupStart - Date.now()))
      nextCleanupStart = Date.now() + LIMITS.cleanupStartIntervalMs
      if (Date.now() < retryAfterUntil) {
        cleanupBlockedReason = 'Rate-limit cooldown is active; stopped remaining cleanup traffic'
        report.cleanup.push({ user: session.user, status: null, logoutAccepted: false, skippedReason: 'Retry-After is active; no cleanup request sent', retryAfterUntil: new Date(retryAfterUntil).toISOString() })
        continue
      }
      const res = await request({ phase: 'cleanup', user: session.user, method: 'POST', body: { refresh_token: session.refreshToken }, token: session.accessToken, cleanup: true })
      report.cleanup.push({ user: session.user, status: res?.status ?? null, logoutAccepted: Boolean(res && res.status === 200 && res.data?.success !== false), ...(res ? {} : { skippedReason: 'Request budget exhausted or Retry-After became active' }) })
      if (!res || res.entry.error || [429, 503].includes(res.status)) {
        cleanupBlockedReason = 'Cleanup stopped after ' + (!res ? 'a skipped request' : res.entry.error ? 'a transport error or timeout' : 'HTTP ' + res.status)
      }
      session.accessToken = null
      session.refreshToken = null
    }
    for (const session of sessions) { session.accessToken = null; session.refreshToken = null }
    sessions.length = 0
    authenticatedSubjects.clear()
    secrets.clear()
    password = null
    report.stopReason = stopReason
    report.stopKind = stopKind
    report.lastPhase = phaseName
    report.completedAt = new Date().toISOString()
    report.requestCount = report.requests.length
    report.peakConcurrency = peakConcurrency
    report.cleanupComplete = report.cleanup.length > 0 && report.cleanup.every((item) => item.logoutAccepted)
    report.cleanupVerification = 'Accepted server logout responses only; no refresh replay or global device logout was performed in this load run.'
    report.cleanupStoppedReason = cleanupBlockedReason
    report.recoveryAttempted = recoveryAttempted
    report.outputDir = folder
    report.sampleDefinition = 'Latency from fetch start through reading full response body. Percentiles use nearest rank for completed HTTP responses; transport errors/timeouts are counted separately. Stage RPS includes draining in-flight reads.'
    report.beforeAfterComparable = Boolean(report.before?.complete && report.after?.complete && report.before.user === report.after.user)
    await mkdir(folder, { recursive: true })
    await writeFile(resolve(folder, 'load-results.json'), JSON.stringify(report, null, 2) + '\n')
  }
  return report
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await runLoadTest({ password: process.env.CHESS_AUDIT_PASSWORD, onProgress: (message) => process.stdout.write(message + '\n') })
  process.stdout.write(JSON.stringify({ outputDir: report.outputDir, requestCount: report.requestCount, availableUsers: report.availableUsers, stopReason: report.stopReason, before: report.before, stages: report.stages.map(({ perUser, ...stage }) => stage), after: report.after, comparison: report.comparison, cleanupComplete: report.cleanupComplete }, null, 2) + '\n')
  if (report.stopReason || !report.beforeAfterComparable || !report.cleanupComplete) process.exitCode = 1
}
