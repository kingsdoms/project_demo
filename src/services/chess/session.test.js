import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createChessSession } from './session.js'
import { chessSocketUrl } from './api.js'

function fixture({ authenticate = async () => 'access-token', onUnauthorized } = {}) {
  let timestamp = 10000
  const sockets = []
  const timers = new Map()
  let timerId = 0
  class Socket {
    constructor(url) { this.url = url; this.readyState = 0; this.frames = []; sockets.push(this) }
    open() { this.readyState = 1; this.onopen?.() }
    send(data) { this.frames.push(JSON.parse(data)) }
    receive(message) { this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) }) }
    close() { this.readyState = 3; this.onclose?.() }
  }
  const session = createChessSession({
    WebSocketImpl: Socket, authenticate, onUnauthorized,
    now: () => timestamp,
    setTimer: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id },
    clearTimer: (id) => timers.delete(id),
  })
  async function ready(room = null) {
    await session.connect()
    sockets.at(-1).open()
    sockets.at(-1).receive({ type: 'READY', uid: 'player', room })
    return sockets.at(-1)
  }
  async function tick() {
    const [id, timer] = timers.entries().next().value
    timestamp += timer.delay
    timers.delete(id)
    timer.callback()
    await Promise.resolve()
    return timer.delay
  }
  return { session, sockets, timers, ready, tick, advance: (ms) => { timestamp += ms } }
}

const position = (overrides = {}) => ({
  room: 'room-1',
  view: {
    mode: 'STANDARD', phase: 'PLAYING', you: 'WHITE', rows: 8, cols: 8,
    pieces: [{ id: 12, kind: 'PAWN', side: 'WHITE', pos: { row: 6, col: 4 } }],
    legal_moves: [{ piece: 12, from: { row: 6, col: 4 }, to: { row: 4, col: 4 }, kind: 'NORMAL' }],
    turn: 'WHITE', ply: 0, result: null, ...overrides,
  },
  clock: { white_ms: 600000, black_ms: 600000, increment_ms: 5000, running: 'WHITE' },
  opponent_connected: true, decide_in_ms: null,
})

test('socket URLs use the API host and never include credentials or a query', () => {
  assert.equal(chessSocketUrl('https://example.test/api'), 'wss://example.test/api/chess/ws')
  assert.equal(chessSocketUrl('http://localhost:4000/api/'), 'ws://localhost:4000/api/chess/ws')
})

test('AUTH is the first frame; actions require READY and never change board optimistically', async () => {
  const f = fixture()
  await f.session.connect()
  const socket = f.sockets[0]
  assert.equal(f.session.send({ type: 'QUEUE', mode: 'STANDARD' }), false)
  socket.open()
  assert.deepEqual(socket.frames, [{ type: 'AUTH', token: 'access-token' }])
  assert.equal(f.session.send({ type: 'QUEUE', mode: 'STANDARD' }), false)
  socket.receive({ type: 'READY', uid: 'player', room: null })
  socket.receive({ type: 'STATE', ...position() })
  const snapshot = f.session.getState().snapshot
  const action = { type: 'GAME', action: { type: 'MOVE', piece: 12, to: { row: 4, col: 4 } } }
  assert.equal(f.session.send(action), true)
  assert.deepEqual(socket.frames.at(-1), action)
  assert.equal(f.session.getState().snapshot, snapshot)
  f.session.disconnect()
})

test('EVENTS uses the full snapshot and records move metadata once per server ply', async () => {
  const f = fixture()
  const socket = await f.ready('room-1')
  socket.receive({ type: 'STATE', ...position() })
  f.advance(150)
  const next = position({ ply: 1, turn: 'BLACK', legal_moves: [], pieces: [{ id: 12, kind: 'PAWN', side: 'WHITE', pos: { row: 4, col: 4 } }] })
  const events = [{ type: 'GAME', event: { type: 'MOVED', piece: 12, from: { row: 6, col: 4 }, to: { row: 4, col: 4 } } }]
  socket.receive({ type: 'EVENTS', ...next, events })
  assert.deepEqual(f.session.getState().snapshot, next)
  assert.equal(f.session.getState().receivedAt, 10150)
  assert.equal(f.session.getState().history[0].notation, 'e2 → e4')
  assert.deepEqual(f.session.getState().lastMove, { from: { row: 6, col: 4 }, to: { row: 4, col: 4 }, piece: 12 })
  socket.receive({ type: 'EVENTS', ...next, events })
  assert.equal(f.session.getState().history.length, 1)
  socket.receive({ type: 'STATE', ...position({ ply: 1, pieces: [] }) })
  assert.deepEqual(f.session.getState().snapshot.view.pieces, [])
  assert.equal(f.session.getState().history.length, 1)
  socket.receive({ type: 'EVENTS', ...next, events: [{ type: 'GAME', event: { type: 'PROMOTED', piece: 12, kind: 'KNIGHT' } }] })
  assert.equal(f.session.getState().history[0].promotion, 'KNIGHT')
  assert.equal(f.session.getState().history[0].notation, 'e2 → e4 = Mã')
  socket.receive({ type: 'STATE', ...position(), room: 'room-2' })
  assert.equal(f.session.getState().history.length, 0)
  f.session.disconnect()
})

test('captured trays use prior snapshot metadata, accept object events, deduplicate and exclude terrain losses', async () => {
  const f = fixture()
  const socket = await f.ready('room-1')
  const pawn = { id: 12, kind: 'PAWN', side: 'WHITE', pos: { row: 4, col: 4 } }
  const victim = { id: 2, kind: 'BISHOP', side: 'BLACK', pos: { row: 3, col: 3 } }
  const terrainLoss = { id: 3, kind: 'ROOK', side: 'BLACK', pos: { row: 3, col: 4 } }
  socket.receive({ type: 'STATE', ...position({ pieces: [pawn, victim, terrainLoss] }) })
  const next = position({ ply: 1, pieces: [{ ...pawn, pos: { row: 3, col: 3 } }] })
  const events = [
    { type: 'GAME', event: { type: 'MOVED', piece: 12, from: pawn.pos, to: victim.pos } },
    { type: 'GAME', event: { type: 'CAPTURED', piece: 2 } },
    { type: 'PIECE_REMOVED', piece: 3, cause: 'broken' },
  ]
  socket.receive({ type: 'EVENTS', ...next, events })
  assert.deepEqual(f.session.getState().captured, { WHITE: [victim], BLACK: [] })
  assert.equal(f.session.getState().history[0].capture, true)
  socket.receive({ type: 'EVENTS', ...next, events })
  assert.equal(f.session.getState().captured.WHITE.length, 1)
  const whiteVictim = { id: 5, kind: 'KNIGHT', side: 'WHITE', pos: { row: 5, col: 1 } }
  socket.receive({ type: 'EVENTS', ...next, events: [{ type: 'GAME', event: { type: 'CAPTURED', piece: whiteVictim } }] })
  assert.deepEqual(f.session.getState().captured.BLACK, [whiteVictim])
  socket.receive({ type: 'EVENTS', ...next, events: [{ type: 'GAME', event: { type: 'CAPTURED', piece: 999 } }] })
  assert.equal(f.session.getState().captured.BLACK.length, 1, 'unknown metadata is not invented')
  socket.close()
  await f.tick()
  const reconnected = f.sockets.at(-1)
  reconnected.open()
  reconnected.receive({ type: 'READY', uid: 'player', room: 'room-1' })
  reconnected.receive({ type: 'STATE', ...next })
  assert.equal(f.session.getState().captured.WHITE.length, 1, 'same-room reconnect retains known history')
  reconnected.receive({ type: 'STATE', ...next, room: 'room-2' })
  assert.deepEqual(f.session.getState().captured, { WHITE: [], BLACK: [] })
  reconnected.receive({ type: 'EVENTS', ...next, room: 'room-2', events: [{ type: 'GAME', event: { type: 'CAPTURED', piece: whiteVictim } }] })
  reconnected.receive({ type: 'STATE', ...position({ result: { reason: 'RESIGNATION', winner: 'BLACK' } }), room: 'room-2' })
  f.session.leaveFinished()
  assert.deepEqual(f.session.getState().captured, { WHITE: [], BLACK: [] })
  f.session.disconnect()
})

test('a server handshake that never reaches READY is retried and malformed frames do not replace a board', async () => {
  const f = fixture()
  await f.session.connect()
  f.sockets[0].open()
  assert.equal(await f.tick(), 15000)
  assert.equal(f.session.getState().status, 'reconnecting')
  assert.equal(await f.tick(), 1000)
  const latest = f.sockets.at(-1)
  latest.open()
  latest.receive({ type: 'READY', uid: 'player', room: 'room-1' })
  latest.receive({ type: 'STATE', ...position() })
  const snapshot = f.session.getState().snapshot
  latest.receive('{ invalid JSON')
  assert.equal(f.session.getState().snapshot, snapshot)
  assert.equal(f.session.getState().error.code, 'CONNECTION.INVALID_MESSAGE')
  latest.receive({ type: 'STATE', room: 'room-1', view: {} })
  assert.equal(f.session.getState().snapshot, snapshot)
  f.session.disconnect()
})

test('intents stay pending without changing the queue, block duplicate sends, and clear only on server acknowledgement', async () => {
  const f = fixture()
  const socket = await f.ready()
  assert.equal(f.session.send({ type: 'QUEUE', mode: 'STANDARD' }), true)
  assert.deepEqual(f.session.getState().pending, { type: 'QUEUE', action: null, startedAt: 10000 })
  assert.equal(f.session.getState().queue, null)
  assert.equal(f.session.send({ type: 'QUEUE', mode: 'STANDARD' }), false)
  socket.receive({ type: 'OPPONENT', connected: true })
  assert.equal(f.session.getState().pending.type, 'QUEUE')
  socket.receive({ type: 'QUEUED', mode: 'STANDARD', season: null })
  assert.equal(f.session.getState().pending, null)
  assert.equal(f.session.getState().queue.mode, 'STANDARD')
  assert.equal(f.timers.size, 0)
  f.session.send({ type: 'CANCEL' })
  assert.equal(f.session.getState().queue.mode, 'STANDARD', 'CANCEL waits for QUEUE_LEFT')
  socket.receive({ type: 'QUEUE_LEFT' })
  assert.equal(f.session.getState().pending, null)
  assert.equal(f.session.getState().queue, null)
  f.session.disconnect()
})

test('a timed-out move requests SYNC, while an ambiguous practice or queue action reconnects', async () => {
  const f = fixture()
  const socket = await f.ready('room-1')
  socket.receive({ type: 'STATE', ...position() })
  const snapshot = f.session.getState().snapshot
  f.session.send({ type: 'GAME', action: { type: 'MOVE', piece: 12, to: { row: 4, col: 4 } } })
  assert.equal(f.session.getState().pending.action, 'MOVE')
  assert.equal(await f.tick(), 12000)
  assert.equal(f.session.getState().pending, null)
  assert.equal(f.session.getState().snapshot, snapshot)
  assert.equal(f.session.getState().error.code, 'CONNECTION.ACTION_TIMEOUT')
  assert.deepEqual(socket.frames.at(-1), { type: 'SYNC' })
  assert.equal(f.session.getState().status, 'ready')
  f.session.send({ type: 'PRACTICE', bot: 'simple' })
  assert.equal(await f.tick(), 12000)
  assert.equal(f.session.getState().status, 'reconnecting')
  assert.equal(f.session.getState().pending, null)
  assert.equal(await f.tick(), 1000)
  assert.equal(f.sockets.length, 2)
  f.session.disconnect()
})

test('server errors clear pending decisions and permit retry without altering the snapshot', async () => {
  const f = fixture()
  const socket = await f.ready('room-1')
  socket.receive({ type: 'STATE', ...position() })
  f.session.send({ type: 'USE_ABILITY', target: { row: 3, col: 3 } })
  assert.equal(f.session.getState().pending.type, 'USE_ABILITY')
  socket.receive({ type: 'ERROR', code: 'MATCH.NOT_ALLOWED', message: 'Kỹ năng chưa hồi' })
  assert.equal(f.session.getState().pending, null)
  assert.equal(f.timers.size, 0)
  assert.equal(f.session.send({ type: 'GAME', action: { type: 'MOVE', piece: 12, to: { row: 4, col: 4 } } }), true)
  socket.receive({ type: 'EVENTS', ...position({ ply: 1 }), events: [] })
  assert.equal(f.session.getState().pending, null)
  f.session.disconnect()
})

test('network loss clears the queue and backs off 1, 2, 4 seconds up to 30 seconds', async () => {
  const f = fixture()
  const socket = await f.ready()
  socket.receive({ type: 'QUEUED', mode: 'EXTENDED', season: 's1' })
  socket.close()
  assert.equal(f.session.getState().status, 'reconnecting')
  assert.equal(f.session.getState().queue, null)
  const delays = []
  for (let index = 0; index < 7; index++) {
    delays.push(await f.tick())
    f.sockets.at(-1).close()
  }
  assert.deepEqual(delays, [1000, 2000, 4000, 8000, 16000, 30000, 30000])
  await f.tick()
  const latest = f.sockets.at(-1)
  latest.open()
  latest.receive({ type: 'READY', uid: 'player', room: 'room-1' })
  latest.receive({ type: 'STATE', ...position({ turn: 'BLACK', ply: 11 }) })
  assert.equal(f.session.getState().snapshot.view.ply, 11)
  latest.close()
  assert.equal(await f.tick(), 1000, 'READY resets backoff')
  f.session.disconnect()
  assert.equal(f.timers.size, 0)
})

test('REPLACED never auto reconnects and only reclaim opens a new authenticated socket', async () => {
  const f = fixture()
  const socket = await f.ready()
  socket.receive({ type: 'REPLACED' })
  assert.equal(f.session.getState().status, 'replaced')
  assert.equal(f.timers.size, 0)
  socket.close()
  assert.equal(f.sockets.length, 1)
  await f.session.reclaim()
  assert.equal(f.sockets.length, 2)
  f.sockets[1].open()
  assert.deepEqual(f.sockets[1].frames, [{ type: 'AUTH', token: 'access-token' }])
  f.session.disconnect()
})

test('AUTH rejection refreshes once; repeated rejection requires login', async () => {
  const authentications = []
  let unauthorized = 0
  const f = fixture({ authenticate: async (options) => { authentications.push(options); return options.forceRefresh ? 'fresh-token' : 'old-token' }, onUnauthorized: () => unauthorized++ })
  await f.session.connect()
  f.sockets[0].open()
  f.sockets[0].receive({ type: 'ERROR', code: 'CHESS.UNAUTHORIZED', message: 'Expired' })
  await Promise.resolve()
  assert.equal(f.sockets.length, 2)
  f.sockets[1].open()
  assert.deepEqual(authentications, [{ forceRefresh: false }, { forceRefresh: true }])
  assert.deepEqual(f.sockets[1].frames, [{ type: 'AUTH', token: 'fresh-token' }])
  f.sockets[1].receive({ type: 'ERROR', code: 'CHESS.UNAUTHORIZED', message: 'Still expired' })
  await Promise.resolve()
  assert.equal(f.session.getState().status, 'unauthorized')
  assert.equal(unauthorized, 1)
  assert.equal(f.timers.size, 0)
})

test('a transient forced-refresh failure retries the refresh without resending the rejected token or logging out', async () => {
  const authentications = []
  let refreshAttempts = 0
  let unauthorized = 0
  const f = fixture({
    authenticate: async (options) => {
      authentications.push(options)
      if (!options.forceRefresh) return 'rejected-token'
      if (++refreshAttempts === 1) throw new Error('Refresh server temporarily unavailable')
      return 'fresh-token'
    },
    onUnauthorized: () => unauthorized++,
  })
  await f.session.connect()
  f.sockets[0].open()
  f.sockets[0].receive({ type: 'ERROR', code: 'CHESS.UNAUTHORIZED', message: 'Token rotated' })
  await Promise.resolve()
  assert.equal(f.session.getState().status, 'reconnecting')
  assert.equal(f.sockets.length, 1, 'failed refresh must not open a socket with the old token')
  assert.equal(unauthorized, 0)
  assert.equal(await f.tick(), 1000)
  assert.deepEqual(authentications, [{ forceRefresh: false }, { forceRefresh: true }, { forceRefresh: true }])
  assert.equal(f.sockets.length, 2)
  const reconnected = f.sockets[1]
  reconnected.open()
  assert.deepEqual(reconnected.frames, [{ type: 'AUTH', token: 'fresh-token' }])
  reconnected.receive({ type: 'READY', uid: 'player', room: null })
  assert.equal(f.session.getState().status, 'ready')
  assert.equal(unauthorized, 0)
  f.session.disconnect()
})

test('disconnect cancels pending authentication and old socket messages cannot overwrite a new session', async () => {
  let finish
  const f = fixture({ authenticate: () => new Promise((resolve) => { finish = resolve }) })
  const connecting = f.session.connect()
  f.session.disconnect()
  finish('old-token')
  await connecting
  assert.equal(f.sockets.length, 0)
  assert.equal(f.session.getState().status, 'idle')

  const current = fixture()
  const old = await current.ready()
  const queuedCallback = old.onmessage
  current.session.disconnect()
  await current.ready()
  queuedCallback({ data: JSON.stringify({ type: 'REPLACED' }) })
  assert.equal(current.session.getState().status, 'ready')
  current.session.disconnect()
})

test('opponent deadline is local time; game errors preserve board and ALREADY_IN_MATCH requests SYNC', async () => {
  const f = fixture()
  const socket = await f.ready('room-1')
  socket.receive({ type: 'STATE', ...position() })
  socket.receive({ type: 'OPPONENT', connected: false, forfeit_in_ms: 45000 })
  assert.equal(f.session.getState().opponentDeadline, 55000)
  assert.equal(f.session.getState().snapshot.opponent_connected, false)
  const snapshot = f.session.getState().snapshot
  socket.receive({ type: 'ERROR', code: 'RULE.ILLEGAL_MOVE', message: 'Nước đi không hợp lệ' })
  assert.equal(f.session.getState().snapshot, snapshot)
  socket.receive({ type: 'ERROR', code: 'CHESS.ALREADY_IN_MATCH', message: 'In match' })
  assert.deepEqual(socket.frames.at(-1), { type: 'SYNC' })
  socket.receive({ type: 'OPPONENT', connected: true })
  assert.equal(f.session.getState().opponentDeadline, null)
  f.session.leaveFinished()
  assert.ok(f.session.getState().snapshot, 'an active game cannot be dismissed as finished')
  socket.receive({ type: 'STATE', ...position({ result: { reason: 'RESIGNATION', winner: 'WHITE' }, phase: 'FINISHED' }) })
  f.session.leaveFinished()
  assert.equal(f.session.getState().snapshot, null)
  assert.equal(f.session.getState().status, 'ready')
  f.session.disconnect()
})
