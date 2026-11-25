import assert from 'node:assert/strict'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Fixtures and static markup only. This does not verify a browser layout,
// pointer interaction, live match, WebSocket exchange, or React effects.
const storage = () => {
  const values = new Map()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
}
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage() })
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage() })
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } })
globalThis.window = { location: { hash: '#home', pathname: '/' } }

const noop = () => {}
const season = {
  id: 'fixture-season', current: true, offer_size: 3, rerolls: 1, decision_seconds: 20,
  characters: ['geomancer', 'frost_witch', 'future_character'],
  cards: [{ id: 'swift_pawns', tier: 'BRONZE' }, { id: 'future_card', tier: 'GOLD' }],
  extreme_weather: ['blizzard', 'future_weather'],
  track: [{ type: 'COIN_FLIP' }, { type: 'NORMAL' }, { type: 'CARD_PICK', tier: 'BRONZE' }, { type: 'EXTREME_WEATHER' }],
  track_loops_from: 1,
}
const catalog = { bots: [{ id: 'fixture-bot', description: 'Bot from fixture data' }], seasons: [season], loading: false, errors: {} }
const view = {
  mode: 'STANDARD', phase: 'PLAYING', you: 'WHITE', rows: 8, cols: 8,
  seats: [{ side: 'WHITE', bot: null }, { side: 'BLACK', bot: null }],
  pieces: [
    { id: 1, kind: 'KING', side: 'WHITE', pos: { row: 7, col: 4 }, has_moved: false },
    { id: 2, kind: 'KING', side: 'BLACK', pos: { row: 0, col: 4 }, has_moved: false },
    { id: 12, kind: 'PAWN', side: 'WHITE', pos: { row: 6, col: 4 }, has_moved: false },
  ],
  turn: 'WHITE', in_check: false, en_passant: null, pending_promotion: null,
  legal_moves: [{ piece: 12, from: { row: 6, col: 4 }, to: { row: 4, col: 4 }, kind: 'NORMAL' }],
  draw_offer: null, result: null, ply: 0, ext: null,
}
const snapshot = { room: 'fixture-room', view, clock: { white_ms: 600000, black_ms: 600000, increment_ms: 5000, running: 'WHITE' }, opponent_connected: true, decide_in_ms: null }
const state = {
  status: 'ready', uid: 'fixture-user', room: snapshot.room, snapshot, receivedAt: Date.now(),
  queue: null, history: [], lastMove: null, events: [], error: null, opponentDeadline: null, pending: null,
}
const players = [
  { side: 'WHITE', character: null, ability_ready_at: 0, cards: [], deciding: true, offer: null, chosen: null },
  { side: 'BLACK', character: null, ability_ready_at: 0, cards: [], deciding: true, offer: { cards: ['opponent_secret_fixture'], tier: 'GOLD', rerolls_left: 1 }, chosen: null },
]
const ext = { season: season.id, round: 3, track: season.track, track_loops_from: 1, track_pos: 2, first: 'BLACK', players, effects: [] }

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
let rendered = 0
function render(Component, props = {}) {
  const html = renderToStaticMarkup(React.createElement(Component, props))
  assert.ok(!html.includes('undefined'), 'markup must not expose undefined values')
  rendered++
  return html
}
try {
  const { default: App, AdminScreen } = await server.ssrLoadModule('/src/app/ChessArenaApp.jsx')
  const { default: AuthDialog } = await server.ssrLoadModule('/src/features/auth/AuthDialog.jsx')
  const { default: ServerBoard } = await server.ssrLoadModule('/src/features/chess/online/ServerBoard.jsx')
  const { default: OnlineLobby } = await server.ssrLoadModule('/src/features/chess/online/OnlineLobby.jsx')
  const { default: OnlineRoom, OnlineQueue } = await server.ssrLoadModule('/src/features/chess/online/OnlineRoom.jsx')
  const { SeasonGuide, RoundTrack, ExtendedPlayer, DecisionOverlay } = await server.ssrLoadModule('/src/features/chess/online/SeasonPanels.jsx')

  for (const route of ['home', 'play', 'game', 'profile', 'settings', 'help', 'privacy', 'terms', 'admin-overview', 'admin-users', 'leaderboard', 'friends', 'history', 'invite', 'replay', 'missing-page']) {
    window.location.hash = '#' + route
    const html = render(App)
    assert.ok(html.includes('main-content'), route + ' must retain the main landmark')
    assert.ok(html.includes('<h1'), route + ' must have a heading')
    if (route === 'home') {
      assert.ok(!html.includes('<span>Bạn bè</span>'), 'unsupported social navigation must be absent')
      assert.ok(!html.includes('<span>Xếp hạng</span>'), 'unsupported ranking navigation must be absent')
      assert.ok(!html.includes('<span>Lịch sử đấu</span>'), 'unsupported match history navigation must be absent')
      assert.ok(!html.includes('Mời bạn chơi'), 'the lobby must not advertise unsupported invitations')
      assert.ok(!/adminSwitch/.test(html), 'the admin entry requires server-confirmed access')
    }
    if (['leaderboard', 'friends', 'history', 'invite', 'replay', 'missing-page'].includes(route)) assert.match(html, /404/, route + ' must show a missing page rather than invented server content')
  }
  for (const page of ['overview', 'users', 'roles', 'notifications', 'blacklist', 'journals', 'commands', 'system']) {
    const html = render(AdminScreen, { page, navigate: noop, onSignIn: noop })
    assert.ok(html.includes('<h1'), page + ' needs an accessible heading')
    assert.ok(html.includes('Đăng nhập'), page + ' must require authentication when signed out')
  }
  for (const initialMode of ['login', 'register', 'otp', 'activate', 'forgot', 'reset']) {
    const html = render(AuthDialog, { initialMode, onClose: noop })
    assert.ok(html.includes('auth-title'))
    assert.ok(html.includes('<form'))
  }

  const lobbyProps = { account: null, signedIn: false, state: { ...state, status: 'idle', snapshot: null }, catalog, lobby: { value: { online: 17, queued: 4, rooms: 6 }, error: '' }, onStart: noop, onAuth: noop, onRefresh: noop }
  const lobbyHtml = render(OnlineLobby, lobbyProps)
  assert.ok(lobbyHtml.includes('fixture-bot'), 'bot choices must come from the server catalog')
  assert.ok(lobbyHtml.includes(season.id), 'season choices must come from the server catalog')
  assert.match(lobbyHtml, />17<.*>4<.*>6</, 'lobby counters must use received data')
  const emptyLobby = render(OnlineLobby, { ...lobbyProps, catalog: { bots: [], seasons: [], loading: false, errors: {} }, lobby: { value: null, error: '' } })
  assert.ok(!emptyLobby.includes('fixture-bot') && !emptyLobby.includes('Stockfish'), 'empty catalogs must not fabricate bot choices')

  const boardProps = { view, selectedId: 12, onSelect: noop, onMove: noop, lastMove: null }
  const boardHtml = render(ServerBoard, boardProps)
  assert.equal((boardHtml.match(/role="gridcell"/g) || []).length, 64)
  assert.ok(boardHtml.includes('aria-label="e4, có thể đi tới"'), 'only server legal destinations should be marked')
  const outOfTurnHtml = render(ServerBoard, { ...boardProps, view: { ...view, turn: 'BLACK' } })
  assert.ok(!outOfTurnHtml.includes('có thể đi tới'), 'an old selected piece cannot expose moves outside our turn')
  const dynamic = { ...view, rows: 6, cols: 10, pieces: [], legal_moves: [] }
  const whiteDynamic = render(ServerBoard, { ...boardProps, view: dynamic })
  const blackDynamic = render(ServerBoard, { ...boardProps, view: { ...dynamic, you: 'BLACK' } })
  assert.equal((whiteDynamic.match(/role="gridcell"/g) || []).length, 60)
  assert.ok(whiteDynamic.includes('aria-rowcount="6" aria-colcount="10"'))
  assert.ok(whiteDynamic.indexOf('aria-label="a6"') < whiteDynamic.indexOf('aria-label="j1"'), 'white orientation starts at the far white rank')
  assert.ok(blackDynamic.indexOf('aria-label="j1"') < blackDynamic.indexOf('aria-label="a6"'), 'black orientation must reverse both axes')
  const effectHtml = render(ServerBoard, { ...boardProps, view: { ...view, mode: 'EXTENDED', ext: { ...ext, effects: [
    { uid: 1, effect: 'future_effect', target: { on: 'TILE', pos: { row: 3, col: 3 } }, expires: 5 },
    { uid: 2, effect: 'skid', target: { on: 'PIECE', piece: 12 }, expires: null },
  ] } } })
  assert.ok(effectHtml.includes('future_effect') && effectHtml.includes('còn 2 vòng'), 'unknown effects need a neutral named fallback and duration')
  assert.ok(!effectHtml.includes('skid'), 'internal skid effect must remain hidden')

  const roomProps = { state, client: { send: noop }, catalog, account: { name: 'Fixture Player' }, sound: false, onSound: noop, onExit: noop, onNewGame: noop }
  const roomHtml = render(OnlineRoom, roomProps)
  assert.equal((roomHtml.match(/role="gridcell"/g) || []).length, 64)
  assert.ok(!roomHtml.includes('Stockfish'), 'online room must not run a local engine')
  const botRoom = render(OnlineRoom, { ...roomProps, state: { ...state, snapshot: { ...snapshot, clock: null, view: { ...view, mode: 'PRACTICE', seats: [{ side: 'WHITE', bot: null }, { side: 'BLACK', bot: 'fixture-bot' }] } } } })
  assert.ok(!botRoom.includes('Đề nghị hoà') && !botRoom.includes('Xin hoà'), 'bot matches must not offer draw actions')
  const promotionRoom = render(OnlineRoom, { ...roomProps, state: { ...state, snapshot: { ...snapshot, view: { ...view, pending_promotion: 12, legal_moves: [] } } } })
  assert.ok(promotionRoom.includes('Phong cấp'), 'reconnecting to a pending promotion must show a promotion selector')
  const otherPromotion = render(OnlineRoom, { ...roomProps, state: { ...state, snapshot: { ...snapshot, view: { ...view, pending_promotion: 2, legal_moves: [] } } } })
  assert.ok(!otherPromotion.includes('Phong cấp tốt'), 'an opponent promotion must not open our selector')
  const drawRoom = render(OnlineRoom, { ...roomProps, state: { ...state, snapshot: { ...snapshot, view: { ...view, draw_offer: 'BLACK' } } } })
  assert.ok(drawRoom.includes('Đối thủ đề nghị hoà') && drawRoom.includes('Đồng ý') && drawRoom.includes('Từ chối'), 'opponent draws must expose both responses')
  const finishedRoom = render(OnlineRoom, { ...roomProps, state: { ...state, snapshot: { ...snapshot, view: { ...view, phase: 'FINISHED', legal_moves: [], result: { reason: 'CHECKMATE', winner: 'WHITE' } } } } })
  assert.ok(finishedRoom.includes('Bạn đã thắng!') && finishedRoom.includes('Chiếu hết') && finishedRoom.includes('Tìm trận mới') && finishedRoom.includes('Về sảnh'), 'finished snapshots must display the server outcome and exit actions')
  const queue = render(OnlineQueue, { state: { ...state, snapshot: null, room: null, queue: { mode: 'EXTENDED', season: season.id, since: Date.now() - 6000 } }, onCancel: noop })
  assert.ok(queue.includes('Đang tìm đối thủ') && queue.includes(season.id) && queue.includes('Huỷ tìm trận'), 'queue state must expose the real mode and cancellation')

  const characterView = { ...view, mode: 'EXTENDED', phase: 'CHARACTER_SELECT', ext }
  const characterChoices = render(DecisionOverlay, { view: characterView, seasons: [season], decideMs: 12000, onSend: noop })
  assert.ok(characterChoices.includes('Chọn Địa sư') && characterChoices.includes('future_character'))
  assert.ok(!characterChoices.includes('Chọn Chỉ huy'), 'known translations must not become hardcoded character availability')
  assert.ok(characterChoices.includes('12s'))
  const waitingCharacter = render(DecisionOverlay, { view: { ...characterView, ext: { ...ext, players: [{ ...players[0], character: 'geomancer', deciding: false }, players[1]] } }, seasons: [season], decideMs: 11000, onSend: noop })
  assert.ok(waitingCharacter.includes('Đã chọn Địa sư') && waitingCharacter.includes('Đang chờ đối thủ'))
  const offer = { tier: 'GOLD', cards: ['swift_pawns', 'future_card'], rerolls_left: 0 }
  const cardView = { ...characterView, phase: 'CARD_PICK', ext: { ...ext, players: [{ ...players[0], character: 'geomancer', offer }, players[1]] } }
  const offeredCards = render(DecisionOverlay, { view: cardView, seasons: [season], decideMs: 7000, onSend: noop })
  assert.ok(offeredCards.includes('Tốt nhanh') && offeredCards.includes('future_card'))
  assert.ok(!offeredCards.includes('opponent_secret_fixture'), 'opponent offers must remain private')
  assert.match(offeredCards, /<button[^>]*disabled=""[^>]*><svg[^]*?Đổi bài/, 'rerolls must be disabled when none remain')
  const waitingCard = render(DecisionOverlay, { view: { ...cardView, ext: { ...cardView.ext, players: [{ ...cardView.ext.players[0], chosen: 0, deciding: false }, players[1]] } }, seasons: [season], decideMs: 6000, onSend: noop })
  assert.ok(waitingCard.includes('Đã chọn Tốt nhanh') && waitingCard.includes('Đang chờ đối thủ'), 'chosen card index zero is a completed decision')
  const exhausted = render(DecisionOverlay, { view: cardView, seasons: [season], decideMs: 0, onSend: noop })
  assert.ok(exhausted.includes('Hết thời gian'), 'expired choices must wait for the server')
  const guide = render(SeasonGuide, { seasons: [season], onClose: noop })
  assert.ok(guide.includes('future_weather') && guide.includes('future_card') && guide.includes('future_character'))
  const track = render(RoundTrack, { ext: { ...ext, effects: [{ uid: 5, effect: 'blizzard', target: { on: 'MATCH' }, expires: 5 }] } })
  assert.ok(track.includes('Bão tuyết') && track.includes('còn 2 vòng') && track.includes('aria-current="step"'))
  const ability = render(ExtendedPlayer, { player: { ...players[0], character: 'geomancer', ability_ready_at: 5 }, view: { ...view, ext }, onAbility: noop })
  assert.ok(ability.includes('Còn 2 vòng') && ability.includes('disabled=""'), 'skills must remain disabled until the server cooldown is ready')
  const opponent = render(ExtendedPlayer, { player: players[1], view: { ...view, ext }, onAbility: noop })
  assert.ok(opponent.includes('Chưa lộ nhân vật') && !opponent.includes('opponent_secret_fixture'), 'opponent offers and unrevealed characters must not leak')

  console.log(`PASS: ${rendered} static fixture/screen renders. Browser layout, interactions, and live API play are not verified by this check.`)
} finally { await server.close() }
