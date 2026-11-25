// Run a local Vite server first, then: node scripts/check-chess-browser.mjs
// Uses installed Playwright or the Codex bundled runtime. Every API request and
// chess socket is mocked by default; these checks never authenticate against a
// real server. Optional --live-public adds read-only, signed-out API CORS checks.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

async function loadPlaywright() {
  if (process.env.CHESS_PLAYWRIGHT_MODULE) return import(pathToFileURL(process.env.CHESS_PLAYWRIGHT_MODULE).href)
  try { return await import('playwright') } catch {
    return import(pathToFileURL(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href)
  }
}

const { chromium } = await loadPlaywright()
const baseUrl = process.env.CHESS_BASE_URL || 'http://localhost:5173'
async function launchBrowser() {
  try { return await chromium.launch({ headless: true, ...(process.env.CHESS_BROWSER_CHANNEL ? { channel: process.env.CHESS_BROWSER_CHANNEL } : {}) }) }
  catch (error) {
    if (process.platform === 'win32' && !process.env.CHESS_BROWSER_CHANNEL && error.message.includes("Executable doesn't exist")) {
      return chromium.launch({ headless: true, channel: 'msedge' })
    }
    throw error
  }
}
const browser = await launchBrowser()
const errors = []
const screenshotDir = join(tmpdir(), 'chessarena-browser-check')
await mkdir(screenshotDir, { recursive: true })
let checks = 0
const check = (condition, message) => { assert.ok(condition, message); checks++ }

async function screenshot(page, name, fullPage = false) {
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0) })
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.screenshot({ path: join(screenshotDir, name), fullPage })
}

async function livePublicSmoke() {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  const results = await page.evaluate(async () => {
    const { API_BASE_URL } = await import('/src/services/api/client.js')
    if (sessionStorage.getItem('co-the.auth-session.v1')) throw new Error('Public smoke must remain signed out')
    return Promise.all(['/chess/bots', '/chess/seasons', '/chess/lobby'].map(async (path) => {
      try {
        const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: 'application/json', ...(API_BASE_URL.includes('.ngrok-free.dev') ? { 'ngrok-skip-browser-warning': 'true' } : {}) }, signal: AbortSignal.timeout(12000) })
        const payload = await response.json()
        return { path, status: response.status, success: response.ok && payload.success === true, shape: Array.isArray(payload.value) ? `array(${payload.value.length})` : typeof payload.value, message: payload.message }
      } catch (error) { return { path, success: false, error: error.message } }
    }))
  })
  console.log(`LIVE PUBLIC SMOKE: ${results.every((result) => result.success) ? 'PASS' : 'UNVERIFIED'} ${JSON.stringify(results)}`)
  await context.close()
}

async function fixture(context) {
  const page = await context.newPage()
  const unexpected = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (!url.pathname.startsWith('/api/')) {
      if (url.origin !== new URL(baseUrl).origin) { unexpected.push(url.href); return route.abort() }
      return route.continue()
    }
    const responses = {
      '/api/account/me': { uid: 'test-user', name: 'Người chơi thử', email: 'browser@example.invalid', roles: [] },
      '/api/account/admin-access': false,
      '/api/chess/bots': [{ id: 'server-only-bot', description: 'Bot lấy từ API kiểm thử' }],
      '/api/chess/lobby': { online: 12, queued: 3, rooms: 5 },
      '/api/chess/seasons': [{ id: 's1', current: true, characters: ['geomancer', 'frost_witch', 'commander'], cards: [{ id: 'swift_pawns', tier: 'BRONZE' }, { id: 'future_card', tier: 'GOLD' }], extreme_weather: ['earthquake', 'cold_snap', 'blizzard'], track: [{ type: 'COIN_FLIP' }, { type: 'NORMAL' }, { type: 'CARD_PICK', tier: 'BRONZE' }, { type: 'EXTREME_WEATHER' }], track_loops_from: 1, offer_size: 3, rerolls: 1, decision_seconds: 20 }],
      '/api/notification': { items: [], page: 1, page_size: 15, total_items: 0, total_pages: 1 },
    }
    if (!Object.hasOwn(responses, url.pathname)) unexpected.push(`${route.request().method()} ${url.pathname}`)
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }, body: JSON.stringify({ success: true, message: null, value: responses[url.pathname] ?? null }) })
  })
  await page.addInitScript(() => {
    sessionStorage.setItem('co-the.auth-session.v1', JSON.stringify({ accessToken: 'browser-test-token', refreshToken: 'browser-test-refresh', accessExp: Math.floor(Date.now() / 1000) + 3600, roles: [] }))
    const nativeSocket = window.WebSocket
    const clone = (value) => JSON.parse(JSON.stringify(value))
    const mock = window.__chessMock = { sockets: [], frames: [], snapshot: null }
    const makeSnapshot = (mode = 'PRACTICE', you = 'WHITE') => ({
      room: 'browser-room',
      view: {
        mode, phase: 'PLAYING', you, rows: 8, cols: 8,
        seats: [{ side: 'WHITE', bot: mode === 'PRACTICE' && you === 'BLACK' ? 'server-only-bot' : null }, { side: 'BLACK', bot: mode === 'PRACTICE' && you === 'WHITE' ? 'server-only-bot' : null }],
        pieces: [{ id: 1, kind: 'KING', side: 'WHITE', pos: { row: 7, col: 4 }, has_moved: false }, { id: 12, kind: 'PAWN', side: 'WHITE', pos: { row: 6, col: 4 }, has_moved: false }, { id: 3, kind: 'KING', side: 'BLACK', pos: { row: 0, col: 4 }, has_moved: false }, { id: 13, kind: 'PAWN', side: 'BLACK', pos: { row: 1, col: 4 }, has_moved: false }],
        turn: you, in_check: false, pending_promotion: null, en_passant: null,
        legal_moves: you === 'WHITE' ? [{ piece: 12, from: { row: 6, col: 4 }, to: { row: 4, col: 4 }, kind: 'NORMAL' }] : [{ piece: 13, from: { row: 1, col: 4 }, to: { row: 3, col: 4 }, kind: 'NORMAL' }],
        draw_offer: null, result: null, ply: 0, ext: null,
      },
      clock: mode === 'PRACTICE' ? null : { white_ms: 600000, black_ms: 600000, increment_ms: 5000, running: you },
      opponent_connected: true, decide_in_ms: null,
    })
    const latest = () => mock.sockets.findLast((socket) => socket.readyState === 1)
    mock.emit = (message) => latest()?.receive(message)
    mock.state = (changes = {}, events = []) => {
      const snapshot = clone(mock.snapshot || makeSnapshot())
      Object.assign(snapshot, changes)
      if (changes.view) snapshot.view = { ...clone(mock.snapshot?.view || makeSnapshot().view), ...changes.view }
      mock.snapshot = snapshot
      mock.emit({ type: events.length ? 'EVENTS' : 'STATE', ...snapshot, ...(events.length ? { events } : {}) })
    }
    mock.match = (mode = 'STANDARD', side = 'WHITE') => {
      mock.snapshot = makeSnapshot(mode, side)
      mock.emit({ type: 'MATCHED', room: mock.snapshot.room, mode, side })
      mock.state()
    }
    mock.ackMove = () => {
      const move = mock.frames.findLast((entry) => entry.frame.type === 'GAME' && entry.frame.action?.type === 'MOVE')?.frame.action
      if (!move) throw new Error('No MOVE to acknowledge')
      const before = mock.snapshot.view.pieces.find((entry) => entry.id === move.piece)
      const from = clone(before.pos)
      mock.state({ view: { pieces: mock.snapshot.view.pieces.map((entry) => entry.id === move.piece ? { ...entry, pos: move.to, has_moved: true, ...(move.promotion ? { kind: move.promotion } : {}) } : entry), turn: mock.snapshot.view.you === 'WHITE' ? 'BLACK' : 'WHITE', legal_moves: [], ply: mock.snapshot.view.ply + 1 } }, [{ type: 'GAME', event: { type: 'MOVED', piece: move.piece, from, to: move.to } }])
    }
    mock.disconnect = () => latest()?.serverClose()
    class MockWebSocket extends EventTarget {
      static CONNECTING = 0
      static OPEN = 1
      static CLOSING = 2
      static CLOSED = 3
      constructor(url, protocols) {
        super()
        if (!new URL(url, location.href).pathname.endsWith('/api/chess/ws')) return new nativeSocket(url, protocols)
        this.url = String(url)
        this.readyState = 0
        this.socketId = mock.sockets.length
        mock.sockets.push(this)
        setTimeout(() => {
          if (this.readyState !== 0) return
          this.readyState = 1
          const event = new Event('open')
          this.onopen?.(event)
          this.dispatchEvent(event)
        }, 0)
      }
      receive(payload) {
        if (this.readyState !== 1) return
        const event = new MessageEvent('message', { data: JSON.stringify(payload) })
        this.onmessage?.(event)
        this.dispatchEvent(event)
      }
      send(data) {
        const frame = JSON.parse(data)
        mock.frames.push({ socket: this.socketId, frame })
        setTimeout(() => {
          if (this.readyState !== 1) return
          if (frame.type === 'AUTH') {
            const resumed = mock.snapshot && !mock.snapshot.view.result
            this.receive({ type: 'READY', uid: 'test-user', room: resumed ? mock.snapshot.room : null })
            if (resumed) mock.state()
          } else if (frame.type === 'PRACTICE') mock.match('PRACTICE', frame.side || 'WHITE')
          else if (frame.type === 'QUEUE') this.receive({ type: 'QUEUED', mode: frame.mode, season: frame.season ?? null })
          else if (frame.type === 'CANCEL') this.receive({ type: 'QUEUE_LEFT' })
          else if (frame.type === 'SYNC') mock.state()
          else if (frame.type === 'GAME' && frame.action?.type === 'PROMOTE') {
            const pending = mock.snapshot.view.pending_promotion
            const id = typeof pending === 'object' ? pending.piece : pending
            mock.state({ view: { pending_promotion: null, pieces: mock.snapshot.view.pieces.map((entry) => entry.id === id ? { ...entry, kind: frame.action.kind } : entry) } }, [{ type: 'GAME', event: { type: 'PROMOTED', piece: id, kind: frame.action.kind } }])
          } else if (frame.type === 'RESIGN') mock.state({ view: { result: { reason: 'RESIGNATION', winner: mock.snapshot.view.you === 'WHITE' ? 'BLACK' : 'WHITE' }, phase: 'FINISHED', legal_moves: [] }, clock: null })
          else if (frame.type === 'OFFER_DRAW') mock.state({ view: { draw_offer: mock.snapshot.view.you } })
          else if (frame.type === 'DECLINE_DRAW') mock.state({ view: { draw_offer: null } })
          else if (frame.type === 'ACCEPT_DRAW') mock.state({ view: { draw_offer: null, result: { reason: 'AGREEMENT', winner: null }, phase: 'FINISHED', legal_moves: [] }, clock: null })
        }, 5)
      }
      serverClose() {
        if (this.readyState === 3) return
        this.readyState = 3
        const event = new CloseEvent('close', { code: 1006 })
        this.onclose?.(event)
        this.dispatchEvent(event)
      }
      close() { this.serverClose() }
    }
    window.WebSocket = MockWebSocket
  })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Đánh với máy', exact: true }).waitFor({ state: 'visible' })
  await page.waitForFunction(() => window.__chessMock.frames.some((entry) => entry.frame.type === 'AUTH'))
  return { page, unexpected }
}

const square = (page, name) => page.getByRole('grid', { name: 'Bàn cờ vua', exact: true }).getByRole('button', { name: new RegExp(`^${name}(?:,|$)`) })
async function waitForFrame(page, type, action) {
  await page.waitForFunction(({ type, action }) => window.__chessMock.frames.some((entry) => entry.frame.type === type && (!action || entry.frame.action?.type === action)), { type, action })
  return page.evaluate(({ type, action }) => window.__chessMock.frames.findLast((entry) => entry.frame.type === type && (!action || entry.frame.action?.type === action)).frame, { type, action })
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  const { page, unexpected } = await fixture(desktop)
  await screenshot(page, 'desktop-lobby.png')
  await page.getByRole('button', { name: 'Tìm trận', exact: true }).click()
  await waitForFrame(page, 'QUEUE')
  await page.getByRole('button', { name: /^(Huỷ|Hủy)/ }).click()
  await waitForFrame(page, 'CANCEL')
  await page.getByRole('button', { name: 'Đánh với máy', exact: true }).waitFor({ state: 'visible' })
  checks++

  await page.getByRole('button', { name: 'Trắng', exact: true }).click()
  await page.getByRole('button', { name: 'Đánh với máy', exact: true }).click()
  const practice = await waitForFrame(page, 'PRACTICE')
  check(practice.bot === 'server-only-bot' && practice.side === 'WHITE', 'practice must use API bot and selected side')
  await square(page, 'e2').waitFor()
  await square(page, 'e2').click()
  await square(page, 'e3').click()
  check(await page.evaluate(() => !window.__chessMock.frames.some((entry) => entry.frame.type === 'GAME')), 'client must not derive e2-e3 when server only provided e2-e4')
  await square(page, 'e2').click()
  await square(page, 'e4').click()
  const move = await waitForFrame(page, 'GAME', 'MOVE')
  check(move.action.piece === 12 && move.action.to.row === 4 && move.action.to.col === 4, 'move frame must identify server piece and square')
  check((await square(page, 'e2').getAttribute('aria-label')).includes('Tốt'), 'piece must stay at e2 before server acknowledgement')
  check(!(await square(page, 'e4').getAttribute('aria-label')).includes('Tốt'), 'client must not optimistically render e4')
  await page.evaluate(() => window.__chessMock.ackMove())
  await page.waitForFunction(() => Array.from(document.querySelectorAll('[role="grid"] button')).some((element) => element.getAttribute('aria-label')?.startsWith('e4, Tốt')))
  check((await square(page, 'e4').getAttribute('aria-label')).includes('Tốt'), 'acknowledged snapshot must move pawn')
  await page.locator('[data-animating="true"]').waitFor({ state: 'hidden' })
  await screenshot(page, 'desktop-room.png')

  // A zero is a valid piece ID; reconnect promotion cannot use a truthiness check.
  await page.evaluate(() => window.__chessMock.state({ view: { turn: 'WHITE', pending_promotion: 0, pieces: [{ id: 0, kind: 'PAWN', side: 'WHITE', pos: { row: 0, col: 4 } }, { id: 1, kind: 'KING', side: 'WHITE', pos: { row: 7, col: 4 } }, { id: 3, kind: 'KING', side: 'BLACK', pos: { row: 0, col: 0 } }], legal_moves: [] } }))
  await page.getByRole('button', { name: /^Hậu$/ }).click()
  const promotion = await waitForFrame(page, 'GAME', 'PROMOTE')
  check(promotion.action.kind === 'QUEEN', 'pending promotion must send PROMOTE')
  await page.getByRole('dialog', { name: 'Phong cấp tốt' }).waitFor({ state: 'hidden' })
  await page.evaluate(() => window.__chessMock.state({ view: { turn: 'WHITE', pending_promotion: null, pieces: [{ id: 12, kind: 'PAWN', side: 'WHITE', pos: { row: 1, col: 4 } }, { id: 1, kind: 'KING', side: 'WHITE', pos: { row: 7, col: 4 } }, { id: 3, kind: 'KING', side: 'BLACK', pos: { row: 0, col: 0 } }], legal_moves: [{ piece: 12, from: { row: 1, col: 4 }, to: { row: 0, col: 4 }, kind: 'NORMAL' }] } }))
  const movesBeforePromotion = await page.evaluate(() => window.__chessMock.frames.filter((entry) => entry.frame.type === 'GAME' && entry.frame.action?.type === 'MOVE').length)
  await square(page, 'e7').click()
  await square(page, 'e8').click()
  await page.getByRole('dialog', { name: 'Phong cấp tốt' }).waitFor()
  check(await page.evaluate(() => window.__chessMock.frames.filter((entry) => entry.frame.type === 'GAME' && entry.frame.action?.type === 'MOVE').length) === movesBeforePromotion, 'promotion must ask before sending MOVE')
  await page.getByRole('button', { name: /^Mã$/ }).click()
  await page.waitForFunction((count) => window.__chessMock.frames.filter((entry) => entry.frame.type === 'GAME' && entry.frame.action?.type === 'MOVE').length > count, movesBeforePromotion)
  check((await waitForFrame(page, 'GAME', 'MOVE')).action.promotion === 'KNIGHT', 'preselected promotion must accompany MOVE')
  await page.evaluate(() => window.__chessMock.ackMove())

  const socketCount = await page.evaluate(() => window.__chessMock.sockets.length)
  await page.evaluate(() => window.__chessMock.emit({ type: 'REPLACED' }))
  await page.getByRole('button', { name: 'Dùng ở đây', exact: true }).waitFor()
  await page.waitForTimeout(1150)
  check(await page.evaluate(() => window.__chessMock.sockets.length) === socketCount, 'REPLACED must not reconnect automatically')
  await page.getByRole('button', { name: 'Dùng ở đây', exact: true }).click()
  await page.waitForFunction((count) => window.__chessMock.sockets.length > count, socketCount)
  checks++
  const beforeDisconnect = await page.evaluate(() => window.__chessMock.sockets.length)
  await page.evaluate(() => window.__chessMock.disconnect())
  await page.waitForFunction((count) => window.__chessMock.sockets.length > count, beforeDisconnect, { timeout: 5000 })
  checks++
  const authFrames = await page.evaluate(() => window.__chessMock.sockets.map((socket) => ({ url: socket.url, first: window.__chessMock.frames.find((entry) => entry.socket === socket.socketId)?.frame })))
  check(authFrames.every((entry) => !entry.url.includes('token') && entry.first?.type === 'AUTH'), 'AUTH must be first frame and token absent from socket URL')
  await page.getByText('Đã kết nối', { exact: true }).waitFor({ state: 'attached' })

  await page.evaluate(() => window.__chessMock.match('STANDARD'))
  await page.getByRole('button', { name: 'Xin hoà', exact: true }).click()
  await waitForFrame(page, 'OFFER_DRAW')
  await page.getByRole('button', { name: 'Đã đề nghị hoà', exact: true }).waitFor()
  check(await page.getByRole('button', { name: 'Đã đề nghị hoà', exact: true }).isDisabled(), 'own draw offer must disable duplicate offers')
  await page.evaluate(() => window.__chessMock.state({ view: { draw_offer: 'BLACK' } }))
  await page.getByRole('button', { name: 'Từ chối', exact: true }).click()
  await waitForFrame(page, 'DECLINE_DRAW')
  await page.getByRole('button', { name: 'Xin hoà', exact: true }).waitFor()
  await page.evaluate(() => window.__chessMock.state({ view: { draw_offer: 'BLACK' } }))
  await page.getByRole('button', { name: 'Đồng ý', exact: true }).click()
  await waitForFrame(page, 'ACCEPT_DRAW')
  const drawResult = page.getByRole('dialog', { name: 'Hoà cờ', exact: true })
  await drawResult.waitFor()
  check(await drawResult.getByText('Thoả thuận hoà', { exact: true }).isVisible(), 'accepted draw must show server result reason')
  await drawResult.getByRole('button', { name: 'Về sảnh', exact: true }).click()
  await page.getByRole('button', { name: 'Đánh với máy', exact: true }).click()
  await page.getByRole('button', { name: 'Đầu hàng', exact: true }).click()
  check(!await page.evaluate(() => window.__chessMock.frames.some((entry) => entry.frame.type === 'RESIGN')), 'resign must require confirmation')
  await page.getByRole('button', { name: 'Xác nhận đầu hàng', exact: true }).click()
  await waitForFrame(page, 'RESIGN')
  const loss = page.getByRole('dialog', { name: 'Bạn đã thua', exact: true })
  await loss.waitFor()
  checks++
  await loss.getByRole('button', { name: 'Về sảnh', exact: true }).click()

  await page.getByRole('button', { name: 'Chế độ mở rộng', exact: true }).click()
  await page.waitForFunction(() => window.__chessMock.frames.some((entry) => entry.frame.type === 'QUEUE' && entry.frame.mode === 'EXTENDED' && entry.frame.season === 's1'))
  await page.evaluate(() => {
    const mock = window.__chessMock
    mock.match('EXTENDED')
    mock.state({ view: { phase: 'CHARACTER_SELECT', legal_moves: [], ext: { season: 's1', round: 0, track: [{ type: 'COIN_FLIP' }, { type: 'NORMAL' }, { type: 'CARD_PICK', tier: 'BRONZE' }, { type: 'EXTREME_WEATHER' }], track_loops_from: 1, track_pos: 0, first: 'WHITE', players: [{ side: 'WHITE', character: null, ability_ready_at: 1, cards: [], deciding: true, offer: null, chosen: null }, { side: 'BLACK', character: null, ability_ready_at: 1, cards: [], deciding: true, offer: null, chosen: null }], effects: [] } }, clock: { white_ms: 600000, black_ms: 600000, increment_ms: 5000, running: null }, decide_in_ms: 20000 })
  })
  await page.getByRole('button', { name: 'Chọn Địa sư', exact: true }).click()
  check((await waitForFrame(page, 'PICK_CHARACTER')).character === 'geomancer', 'character choice must send server character code')
  await page.evaluate(() => {
    const mock = window.__chessMock
    const ext = JSON.parse(JSON.stringify(mock.snapshot.view.ext))
    Object.assign(ext.players[0], { character: 'geomancer', deciding: false })
    mock.state({ view: { ext } })
  })
  await page.getByText('Đã chọn Địa sư', { exact: true }).waitFor()
  check(await page.getByText('Chưa lộ nhân vật', { exact: true }).isVisible(), 'unrevealed opponent character must stay hidden')
  await page.evaluate(() => {
    const mock = window.__chessMock
    const ext = JSON.parse(JSON.stringify(mock.snapshot.view.ext))
    ext.round = 4; ext.track_pos = 2
    Object.assign(ext.players[0], { deciding: true, offer: { tier: 'BRONZE', cards: ['swift_pawns', 'future_card'], rerolls_left: 1 }, chosen: null })
    mock.state({ view: { phase: 'CARD_PICK', ext }, decide_in_ms: 20000 })
  })
  await page.getByRole('button', { name: /^Đổi bài/ }).click()
  await waitForFrame(page, 'REROLL')
  await page.evaluate(() => {
    const mock = window.__chessMock
    const ext = JSON.parse(JSON.stringify(mock.snapshot.view.ext))
    ext.players[0].offer.rerolls_left = 0
    mock.state({ view: { ext } })
  })
  check(await page.getByRole('button', { name: /^Đổi bài/ }).isDisabled(), 'reroll must disable when server says zero remaining')
  await page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'future_card', exact: true }) }).getByRole('button', { name: 'Chọn thẻ này', exact: true }).click()
  check((await waitForFrame(page, 'PICK_CARD')).index === 1, 'unknown card codes must render safely and send offered index')
  await page.evaluate(() => {
    const mock = window.__chessMock
    const ext = JSON.parse(JSON.stringify(mock.snapshot.view.ext))
    Object.assign(ext.players[0], { deciding: false, chosen: 1 })
    mock.state({ view: { ext } })
  })
  await page.getByText('Đã chọn future_card', { exact: true }).waitFor()
  for (const [character, target, pos] of [['geomancer', 'a4', { row: 4, col: 0 }], ['frost_witch', 'e7', { row: 1, col: 4 }], ['commander', 'e2', { row: 6, col: 4 }]]) {
    await page.evaluate((character) => {
      const mock = window.__chessMock
      const ext = JSON.parse(JSON.stringify(mock.snapshot.view.ext))
      ext.round = 5; ext.track_pos = 1
      Object.assign(ext.players[0], { character, ability_ready_at: 1, deciding: false, cards: ['swift_pawns', 'future_card'], chosen: null, offer: null })
      Object.assign(ext.players[1], { character: 'commander', deciding: false })
      mock.state({ view: { phase: 'PLAYING', turn: 'WHITE', ext, legal_moves: [{ piece: 12, from: { row: 6, col: 4 }, to: { row: 4, col: 4 }, kind: 'NORMAL' }] }, decide_in_ms: null })
    }, character)
    const abilityCount = await page.evaluate(() => window.__chessMock.frames.filter((entry) => entry.frame.type === 'USE_ABILITY').length)
    await page.getByRole('button', { name: 'Kỹ năng', exact: true }).click()
    await square(page, target).click()
    await page.waitForFunction((count) => window.__chessMock.frames.filter((entry) => entry.frame.type === 'USE_ABILITY').length > count, abilityCount)
    assert.deepEqual((await waitForFrame(page, 'USE_ABILITY')).target, pos)
    checks++
  }
  await page.evaluate(() => {
    const mock = window.__chessMock
    const ext = JSON.parse(JSON.stringify(mock.snapshot.view.ext))
    ext.players[0].ability_ready_at = 8
    ext.effects = [
      { uid: 1, effect: 'broken', target: { on: 'TILE', pos: { row: 4, col: 3 } }, expires: 7 },
      { uid: 2, effect: 'cracked', target: { on: 'TILE', pos: { row: 4, col: 2 } }, expires: 6 },
      { uid: 3, effect: 'cold', target: { on: 'TILE', pos: { row: 4, col: 5 } }, expires: 8 },
      { uid: 4, effect: 'ice', target: { on: 'TILE', pos: { row: 4, col: 6 } }, expires: 8 },
      { uid: 5, effect: 'future_effect', target: { on: 'TILE', pos: { row: 4, col: 1 } }, expires: null },
      { uid: 6, effect: 'frozen', target: { on: 'PIECE', piece: 13 }, expires: 7 },
      { uid: 7, effect: 'slowed', target: { on: 'PIECE', piece: 12 }, expires: 6 },
      { uid: 8, effect: 'skid', target: { on: 'PIECE', piece: 12 }, expires: 6 },
      { uid: 9, effect: 'blizzard', target: { on: 'MATCH' }, expires: 7 },
    ]
    mock.state({ view: { ext } }, [{ type: 'ROUND_STARTED', round: 5, track_pos: 1, slot: { type: 'NORMAL' } }])
  })
  check(await page.getByRole('button', { name: 'Còn 3 vòng', exact: true }).isDisabled(), 'ability cooldown must follow server rounds')
  await square(page, 'b4').click()
  check((await page.getByRole('tooltip').textContent()).includes('future_effect'), 'unknown effect must have neutral rendering and code tooltip')
  check(!(await square(page, 'e2').getAttribute('aria-label')).includes('skid'), 'internal skid effect must not be exposed')
  await screenshot(page, 'desktop-extended.png')
  check(unexpected.length === 0, `all API calls must be mocked; unexpected: ${unexpected.join(', ')}`)
  await desktop.close()

  const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  const { page: phone, unexpected: mobileUnexpected } = await fixture(mobile)
  await phone.getByRole('button', { name: 'Đen', exact: true }).click()
  await phone.getByRole('button', { name: 'Đánh với máy', exact: true }).click()
  await phone.getByRole('grid', { name: 'Bàn cờ vua', exact: true }).waitFor()
  check(await phone.getByRole('grid', { name: 'Bàn cờ vua', exact: true }).locator('[role="row"]').first().getByRole('button').first().getAttribute('aria-label') === 'h1', 'black board must rotate both axes')
  const grid = await phone.getByRole('grid', { name: 'Bàn cờ vua', exact: true }).boundingBox()
  check(grid.x >= 0 && grid.x + grid.width <= 376, 'board must fit 375px viewport')
  check(await phone.evaluate(() => document.documentElement.scrollWidth <= 375), 'mobile must not overflow horizontally')
  await square(phone, 'e7').tap()
  await square(phone, 'e5').tap()
  const blackMove = await waitForFrame(phone, 'GAME', 'MOVE')
  check(blackMove.action.piece === 13 && blackMove.action.to.row === 3, 'black tap move must keep canonical server coordinates')
  await phone.evaluate(() => window.__chessMock.state({ view: { turn: 'BLACK' } }))
  const from = await square(phone, 'e7').boundingBox()
  const to = await square(phone, 'e5').boundingBox()
  const beforeDrag = await phone.evaluate(() => window.__chessMock.frames.filter((entry) => entry.frame.type === 'GAME' && entry.frame.action?.type === 'MOVE').length)
  // Native touch input exercises pointer capture and destination mapping.
  const touch = await mobile.newCDPSession(phone)
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
  const end = { x: to.x + to.width / 2, y: to.y + to.height / 2 }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
  for (let step = 1; step <= 8; step++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + (end.x - start.x) * step / 8, y: start.y + (end.y - start.y) * step / 8 }] })
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await touch.detach()
  await phone.waitForFunction((count) => window.__chessMock.frames.filter((entry) => entry.frame.type === 'GAME' && entry.frame.action?.type === 'MOVE').length > count, beforeDrag)
  checks++
  const scrollBeforeAck = await phone.evaluate(() => window.scrollY)
  await phone.evaluate(() => window.__chessMock.ackMove())
  await phone.locator('[data-animating="true"]').waitFor({ state: 'hidden' })
  check(Math.abs(await phone.evaluate(() => window.scrollY) - scrollBeforeAck) < 1, 'acknowledged mobile move must not scroll the whole page')
  await screenshot(phone, 'mobile-room.png', true)
  check(mobileUnexpected.length === 0, `unexpected mobile requests: ${mobileUnexpected.join(', ')}`)
  await mobile.close()
  console.log(`Screenshots: ${screenshotDir}`)
  check(errors.length === 0, `browser runtime errors: ${errors.join('\n')}`)
  console.log(`PASS: ${checks} mocked browser checks (desktop and mobile 375px). Live server play is not covered.`)
  if (process.argv.includes('--live-public')) await livePublicSmoke()
} catch (error) {
  console.error(`Runtime errors: ${errors.join('\n') || 'none'}`)
  for (const [index, context] of browser.contexts().entries()) for (const page of context.pages()) {
    await page.screenshot({ path: join(screenshotDir, `failure-${index}.png`), fullPage: true }).catch(() => {})
  }
  console.error(`Failure screenshots: ${screenshotDir}`)
  throw error
} finally { await browser.close() }
