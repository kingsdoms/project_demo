import { ApiError, ensureAccessToken } from '../api/client.js'
import { CHESS_WS_URL } from './api.js'

const initialState = () => ({
  status: 'idle', uid: null, room: null, snapshot: null, receivedAt: 0,
  queue: null, history: [], captured: { WHITE: [], BLACK: [] }, lastMove: null, events: [], error: null,
  opponentDeadline: null, pending: null,
})

const INTENTS = new Set(['QUEUE', 'PRACTICE', 'CANCEL', 'GAME', 'RESIGN', 'OFFER_DRAW', 'ACCEPT_DRAW', 'DECLINE_DRAW', 'PICK_CHARACTER', 'PICK_CARD', 'REROLL', 'USE_ABILITY'])
const ACKNOWLEDGEMENTS = new Set(['READY', 'STATE', 'EVENTS', 'QUEUED', 'QUEUE_LEFT', 'ERROR'])

const normalizeEvent = (event) => event?.type === 'GAME' ? event.event : event
const squareName = (pos, rows) => `${String.fromCharCode(97 + pos.col)}${rows - pos.row}`
const pieceId = (piece) => typeof piece === 'object' ? piece?.id : piece
const promotionName = (kind) => ({ QUEEN: 'Hậu', ROOK: 'Xe', BISHOP: 'Tượng', KNIGHT: 'Mã' })[kind] || kind

function addCaptured(state, events) {
  let captured = state.captured
  for (const raw of events) {
    const event = normalizeEvent(raw)
    if (event?.type !== 'CAPTURED') continue
    const id = pieceId(event.piece)
    if (captured.WHITE.some((piece) => piece.id === id) || captured.BLACK.some((piece) => piece.id === id)) continue
    const previous = state.snapshot?.view?.pieces?.find((piece) => piece.id === id)
    const piece = previous ?? (typeof event.piece === 'object' ? event.piece : null)
    if (!piece?.kind || !['WHITE', 'BLACK'].includes(piece.side)) continue
    const by = piece.side === 'WHITE' ? 'BLACK' : 'WHITE'
    captured = { ...captured, [by]: [...captured[by], { ...piece, ...(piece.pos ? { pos: { ...piece.pos } } : {}) }] }
  }
  return captured
}

function addHistory(state, snapshot, events) {
  const gameEvents = events.map(normalizeEvent)
  const moves = gameEvents.filter((event) => event?.type === 'MOVED')
  let history = state.history
  for (const event of gameEvents) {
    if (event?.type !== 'PROMOTED') continue
    const promoted = history.findLastIndex((entry) => entry.piece === pieceId(event.piece))
    if (promoted >= 0 && history[promoted].promotion !== event.kind) {
      history = history.map((entry, index) => index === promoted
        ? { ...entry, promotion: event.kind, notation: `${entry.notation.split(' = ')[0]} = ${promotionName(event.kind)}` }
        : entry)
    }
  }
  if (!moves.length) return { history, lastMove: state.lastMove }
  history = [...history]
  const previousPieces = state.snapshot?.view?.pieces ?? []
  const currentPieces = snapshot.view?.pieces ?? []
  for (const [index, move] of moves.entries()) {
    if (!move.from || !move.to) continue
    const idPiece = pieceId(move.piece)
    const piece = previousPieces.find((item) => item.id === idPiece) ?? currentPieces.find((item) => item.id === idPiece)
    const ply = (snapshot.view?.ply ?? history.length + moves.length) - moves.length + index + 1
    const id = `${snapshot.room}:${ply}:${idPiece}`
    if (history.some((entry) => entry.id === id)) continue
    const promotion = gameEvents.find((event) => event?.type === 'PROMOTED' && pieceId(event.piece) === idPiece)?.kind ?? null
    const castle = gameEvents.some((event) => event?.type === 'CASTLED')
    const capture = gameEvents.some((event) => event?.type === 'CAPTURED')
    const side = piece?.side ?? (ply % 2 ? 'WHITE' : 'BLACK')
    history.push({
      id, ply, side, piece: idPiece, kind: piece?.kind, from: move.from, to: move.to,
      capture, castle, promotion,
      notation: `${squareName(move.from, snapshot.view?.rows ?? 8)}${capture ? '×' : ' → '}${squareName(move.to, snapshot.view?.rows ?? 8)}${promotion ? ` = ${promotionName(promotion)}` : ''}`,
    })
  }
  const last = moves.at(-1)
  return { history, lastMove: { from: last.from, to: last.to, piece: last.piece } }
}

/** A single authenticated socket. It never calculates moves or changes the board on send. */
export function createChessSession({
  url = CHESS_WS_URL,
  WebSocketImpl = globalThis.WebSocket,
  authenticate = ensureAccessToken,
  now = Date.now,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
  onUnauthorized = () => {},
} = {}) {
  let state = initialState()
  const listeners = new Set()
  let socket = null
  let active = false
  let generation = 0
  let reconnectTimer = null
  let handshakeTimer = null
  let pendingTimer = null
  let retryCount = 0
  let authRetried = false
  let lastQueue = null

  function update(patch) {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }

  function clearTimers() {
    if (reconnectTimer != null) clearTimer(reconnectTimer)
    if (handshakeTimer != null) clearTimer(handshakeTimer)
    reconnectTimer = null
    handshakeTimer = null
    clearPendingTimer()
  }

  function clearPendingTimer() {
    if (pendingTimer != null) clearTimer(pendingTimer)
    pendingTimer = null
  }

  function stopSocket() {
    generation++
    if (handshakeTimer != null) clearTimer(handshakeTimer)
    handshakeTimer = null
    clearPendingTimer()
    const oldSocket = socket
    socket = null
    if (oldSocket) {
      oldSocket.onopen = null
      oldSocket.onmessage = null
      oldSocket.onclose = null
      oldSocket.onerror = null
      try { oldSocket.close() } catch { /* A socket may still be opening. */ }
    }
  }

  function unauthorized(message) {
    active = false
    clearTimers()
    stopSocket()
    update({ status: 'unauthorized', queue: null, pending: null, error: { code: 'CHESS.UNAUTHORIZED', message } })
    onUnauthorized()
  }

  function scheduleReconnect(error, forceRefresh = false) {
    if (!active || reconnectTimer != null) return
    update({ status: 'reconnecting', queue: null, pending: null, ...(error ? { error } : {}) })
    const delay = Math.min(1000 * 2 ** retryCount++, 30000)
    reconnectTimer = setTimer(() => {
      reconnectTimer = null
      void openSocket(forceRefresh)
    }, delay)
  }

  function send(message) {
    if (state.status !== 'ready' || socket?.readyState !== 1) return false
    if (INTENTS.has(message.type) && state.pending) return false
    try {
      socket.send(JSON.stringify(message))
      if (message.type === 'QUEUE') lastQueue = { mode: message.mode, season: message.season ?? null }
      if (INTENTS.has(message.type)) {
        update({ pending: { type: message.type, action: message.action?.type ?? null, startedAt: now() } })
        pendingTimer = setTimer(() => {
          pendingTimer = null
          if (!active || !state.pending) return
          const timedOutType = state.pending.type
          const error = { code: 'CONNECTION.ACTION_TIMEOUT', message: 'Chưa nhận được xác nhận từ máy chủ. Đang đồng bộ lại…' }
          update({ pending: null, error })
          if (state.room && !['QUEUE', 'PRACTICE', 'CANCEL'].includes(timedOutType)) send({ type: 'SYNC' })
          else { stopSocket(); scheduleReconnect(error) }
        }, 12000)
      }
      return true
    } catch {
      stopSocket()
      scheduleReconnect()
      return false
    }
  }

  async function retryAuthorization(message) {
    if (authRetried) { unauthorized(message || 'Phiên đã hết hạn. Hãy đăng nhập lại.'); return }
    authRetried = true
    stopSocket()
    await openSocket(true)
  }

  function receive(message) {
    if (ACKNOWLEDGEMENTS.has(message.type)) {
      clearPendingTimer()
      if (state.pending) update({ pending: null })
    }
    switch (message.type) {
      case 'READY':
        retryCount = 0
        authRetried = false
        if (handshakeTimer != null) clearTimer(handshakeTimer)
        handshakeTimer = null
        update({ status: 'ready', uid: message.uid, room: message.room ?? null, queue: null, error: null,
          ...(message.room == null ? { snapshot: null, history: [], captured: { WHITE: [], BLACK: [] }, lastMove: null, events: [], opponentDeadline: null } : {}) })
        break
      case 'QUEUED':
        update({ queue: { mode: message.mode, season: message.season ?? null, since: now() }, error: null })
        break
      case 'QUEUE_LEFT':
        lastQueue = null
        update({ queue: null })
        break
      case 'MATCHED':
        update({ room: message.room, queue: null, history: [], captured: { WHITE: [], BLACK: [] }, lastMove: null, events: [], snapshot: null, opponentDeadline: null, error: null })
        break
      case 'STATE':
      case 'EVENTS': {
        // Every snapshot is complete. Events are presentation metadata only.
        if (!message.view || !Array.isArray(message.view.pieces)) return
        const snapshot = { ...message }
        delete snapshot.type
        delete snapshot.events
        const events = Array.isArray(message.events) ? message.events : []
        const sameRoom = snapshot.room === state.snapshot?.room
        const base = sameRoom ? state : { ...state, history: [], captured: { WHITE: [], BLACK: [] }, lastMove: null, snapshot: null }
        const history = addHistory(base, snapshot, events)
        update({ snapshot, receivedAt: now(), room: snapshot.room, queue: null, events, ...history, captured: addCaptured(base, events),
          opponentDeadline: snapshot.opponent_connected === false ? state.opponentDeadline ?? now() + 60000 : null })
        break
      }
      case 'OPPONENT':
        update({ opponentDeadline: message.connected ? null : now() + (message.forfeit_in_ms ?? 60000),
          ...(state.snapshot ? { snapshot: { ...state.snapshot, opponent_connected: message.connected } } : {}) })
        break
      case 'REPLACED':
        active = false
        clearTimers()
        stopSocket()
        update({ status: 'replaced', queue: null, pending: null })
        break
      case 'ERROR': {
        const error = { code: message.code, message: message.message || 'Không thể thực hiện thao tác.' }
        update({ error })
        if (message.code === 'CHESS.UNAUTHORIZED') void retryAuthorization(error.message)
        else if (message.code === 'CHESS.ALREADY_IN_MATCH') send({ type: 'SYNC' })
        else if (message.code === 'CHESS.NOT_IN_MATCH') update({ room: null, snapshot: null, queue: null, history: [], captured: { WHITE: [], BLACK: [] }, lastMove: null, events: [], opponentDeadline: null })
        else if (message.code === 'CHESS.NOT_QUEUED') update({ queue: null })
        else if (message.code === 'CHESS.ALREADY_QUEUED' && lastQueue) update({ queue: { ...lastQueue, since: state.queue?.since ?? now() } })
        break
      }
      default: break
    }
  }

  async function openSocket(forceRefresh = false) {
    if (!active) return
    const current = ++generation
    update({ status: retryCount || state.snapshot ? 'reconnecting' : 'connecting', pending: null })
    try {
      const token = await authenticate({ forceRefresh })
      if (!active || current !== generation) return
      if (!token) { unauthorized('Phiên đã hết hạn. Hãy đăng nhập lại.'); return }
      const connection = new WebSocketImpl(url)
      socket = connection
      const isCurrent = () => active && generation === current && socket === connection
      handshakeTimer = setTimer(() => {
        if (!isCurrent() || state.status === 'ready') return
        stopSocket()
        scheduleReconnect({ code: 'CONNECTION.TIMEOUT', message: 'Kết nối quá lâu, đang thử lại…' })
      }, 15000)
      connection.onopen = () => {
        if (!isCurrent()) return
        // The token is deliberately absent from the URL and is the first frame.
        try { connection.send(JSON.stringify({ type: 'AUTH', token })) }
        catch { stopSocket(); scheduleReconnect() }
      }
      connection.onmessage = ({ data }) => {
        if (!isCurrent()) return
        try {
          const message = JSON.parse(data)
          if (message && typeof message.type === 'string') receive(message)
        } catch {
          update({ error: { code: 'CONNECTION.INVALID_MESSAGE', message: 'Dữ liệu ván cờ chưa hợp lệ. Hãy đồng bộ lại.' } })
        }
      }
      connection.onerror = () => {
        // Browsers deliver close after error; closing also covers failed handshakes.
        if (!isCurrent()) return
        stopSocket()
        scheduleReconnect()
      }
      connection.onclose = () => {
        if (!isCurrent()) return
        stopSocket()
        scheduleReconnect()
      }
    } catch (error) {
      if (!active || current !== generation) return
      if (error instanceof ApiError && [401, 403].includes(error.status)) unauthorized(error.message)
      else scheduleReconnect({ code: 'CONNECTION.FAILED', message: error.message || 'Không kết nối được máy chủ.' }, forceRefresh)
    }
  }

  function connect() {
    if (active) return Promise.resolve()
    active = true
    retryCount = 0
    authRetried = false
    return openSocket()
  }

  function disconnect() {
    active = false
    clearTimers()
    stopSocket()
    lastQueue = null
    update(initialState())
  }

  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    getState: () => state,
    connect,
    disconnect,
    send,
    reclaim: () => { active = false; clearTimers(); stopSocket(); return connect() },
    clearError: () => update({ error: null }),
    leaveFinished: () => {
      if (!state.snapshot?.view?.result) return
      update({ room: null, snapshot: null, history: [], captured: { WHITE: [], BLACK: [] }, lastMove: null, events: [], opponentDeadline: null })
    },
  }
}
