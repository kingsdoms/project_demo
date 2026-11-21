import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Game } from '../../core/models/Game.js'
import { Board } from '../../core/models/Board.js'
import { Piece } from '../../core/models/piece.js'
import { Action } from '../../core/models/Action.js'
import { reduce } from '../../core/engine/reduce.js'
import { BOT_LEVELS, createStockfishBot, gameToFen, getBotLevel, parseUciMove } from './index.js'

const piece = (type, side, row, col, hasMoved = false) => new Piece({ type, side, row, col, hasMoved })
const position = (pieces, extra = {}) => new Game({ board: new Board(8, 8, pieces), ...extra })
const promotionPosition = () => position([
  piece('KING', 'WHITE', 7, 4), piece('KING', 'BLACK', 0, 7), piece('PAWN', 'WHITE', 1, 0, true),
])

class FakeWorker {
  listeners = new Map()
  commands = []
  terminated = 0
  onCommand = null
  autoHandshake = true
  constructor({ autoHandshake = true, onCommand } = {}) { this.autoHandshake = autoHandshake; this.onCommand = onCommand }
  addEventListener(name, fn) { this.listeners.set(name, fn) }
  emit(data) { this.listeners.get('message')?.({ data }) }
  error(message = 'Failed to load WebAssembly') { this.listeners.get('error')?.({ message, preventDefault() {} }) }
  postMessage(command) {
    this.commands.push(command)
    if (this.autoHandshake && command === 'uci') queueMicrotask(() => this.emit([
      'id name Stockfish Test',
      'option name Threads type spin default 1 min 1 max 1\noption name Hash type spin default 16 min 1 max 1024',
      'option name Ponder type check default false',
      'option name UCI_Chess960 type check default false',
      'option name UCI_LimitStrength type check default false',
      'option name Skill Level type spin default 20 min 0 max 20',
      'uciok',
    ]))
    if (this.autoHandshake && command === 'isready') queueMicrotask(() => this.emit('readyok'))
    this.onCommand?.(command, this)
  }
  terminate() { this.terminated++ }
}

const turn = () => new Promise((resolve) => setTimeout(resolve, 0))
function setup(options = {}, workerOptions = {}) {
  const worker = new FakeWorker(workerOptions)
  const statuses = []
  const bot = createStockfishBot({ ...options, onStatus: (status) => statuses.push(status), workerFactory: () => worker })
  return { worker, bot, statuses }
}

test('FEN includes the standard board, turn, castling rights and en-passant target', () => {
  const game = Game.initialStandard()
  assert.equal(gameToFen(game), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  const pawn = game.board.pieceAt(6, 4)
  const after = reduce(game, Action.move(pawn.id, 4, 4))
  assert.equal(gameToFen(after), 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')
  const movedRook = game.board.pieceAt(7, 0)
  const changed = game.with({ board: game.board.remove(movedRook.id).add(movedRook.with({ hasMoved: true })) })
  assert.equal(gameToFen(changed).split(' ')[2], 'Kkq')
})

test('FEN does not restore castling after a king has moved or a rook is missing', () => {
  const game = Game.initialStandard()
  const king = game.board.pieceAt(7, 4)
  const blackRook = game.board.pieceAt(0, 7)
  const changed = game.with({ board: game.board.remove(king.id).add(king.with({ hasMoved: true })).remove(blackRook.id) })
  assert.equal(gameToFen(changed).split(' ')[2], 'q')
})

test('the UCI bridge validates normal moves, castling and en passant through the local rules', () => {
  const normal = parseUciMove(Game.initialStandard(), 'e2e4')
  assert.equal(normal.action.id, 'PAWN-WHITE-6-4')
  assert.equal(normal.action.row, 4)
  assert.equal(normal.promotion, null)
  assert.throws(() => parseUciMove(Game.initialStandard(), 'e2e5'), /không hợp lệ/)
  assert.throws(() => parseUciMove(Game.initialStandard(), 'not-a-move'), /định dạng/)
  assert.throws(() => parseUciMove(Game.initialStandard(), '0000'), /còn nước hợp lệ/)
  const castling = position([piece('KING', 'WHITE', 7, 4), piece('ROOK', 'WHITE', 7, 7), piece('KING', 'BLACK', 0, 4)])
  const castle = reduce(castling, parseUciMove(castling, 'e1g1').action)
  assert.equal(castle.board.pieceAt(7, 6).type, 'KING')
  assert.equal(castle.board.pieceAt(7, 5).type, 'ROOK')
  const ep = position([piece('KING', 'WHITE', 7, 4), piece('KING', 'BLACK', 0, 4), piece('PAWN', 'WHITE', 3, 4, true), piece('PAWN', 'BLACK', 3, 3, true)], { enPassantTarget: { row: 2, col: 3 } })
  const captured = reduce(ep, parseUciMove(ep, 'e5d6').action)
  assert.equal(captured.board.pieceAt(3, 3), null)
  assert.equal(captured.board.pieceAt(2, 3).side, 'WHITE')
})

test('the UCI bridge retains every legal underpromotion and rejects missing or spurious promotion codes', () => {
  const game = promotionPosition()
  for (const [letter, type] of [['q', 'QUEEN'], ['r', 'ROOK'], ['b', 'BISHOP'], ['n', 'KNIGHT']]) {
    assert.equal(parseUciMove(game, 'a7a8' + letter).promotion.type, type)
  }
  assert.throws(() => parseUciMove(game, 'a7a8'), /phong cấp/)
  assert.throws(() => parseUciMove(Game.initialStandard(), 'e2e4q'), /phong cấp/)
  const pending = reduce(game, parseUciMove(game, 'a7a8n').action)
  assert.throws(() => gameToFen(pending), /hoàn tất phong cấp/)
})

test('every difficulty preset sends actual Stockfish skill/depth/time settings and reuses one worker', async () => {
  assert.equal(getBotLevel('unknown').key, 'medium')
  assert.equal(getBotLevel({ key: 'hard' }).key, 'hard')
  assert.equal(BOT_LEVELS.length, 6)
  assert.equal(BOT_LEVELS[0].skill, 0)
  assert.equal(BOT_LEVELS.at(-1).skill, 20)
  for (const level of BOT_LEVELS) {
    const { bot, worker, statuses } = setup({ level: level.key }, { onCommand: (command, instance) => { if (command.startsWith('go ')) queueMicrotask(() => instance.emit('info depth 2 score cp 14\nbestmove e2e4 ponder e7e5')) } })
    await bot.ready
    const result = await bot.choose(Game.initialStandard())
    assert.equal(result.row, 4)
    assert.ok(worker.commands.includes('setoption name Skill Level value ' + level.skill))
    assert.ok(worker.commands.includes('setoption name UCI_LimitStrength value false'))
    assert.ok(worker.commands.includes('setoption name Threads value 1'))
    assert.ok(worker.commands.includes('go depth ' + level.depth + ' movetime ' + level.moveTime))
    await bot.choose(Game.initialStandard())
    assert.equal(worker.commands.filter((command) => command === 'uci').length, 1)
    assert.ok(statuses.some((status) => status.state === 'thinking' && status.engineName === 'Stockfish Test'))
    bot.stop()
    bot.stop()
    assert.equal(worker.terminated, 1)
  }
})

test('the adapter completes the exact promotion selected by Stockfish without a second engine search', async () => {
  const { bot, worker } = setup({}, { onCommand: (command, instance) => { if (command.startsWith('go ')) queueMicrotask(() => instance.emit('bestmove a7a8n')) } })
  const game = promotionPosition()
  const move = await bot.choose(game)
  const pending = reduce(game, move)
  const promote = await bot.choose(pending)
  assert.equal(promote.pieceType, 'KNIGHT')
  assert.equal(reduce(pending, promote).board.pieceAt(0, 0).type, 'KNIGHT')
  assert.equal(worker.commands.filter((command) => command.startsWith('go ')).length, 1)
  bot.stop()
})

test('a newer position cancels and drains a stale search before receiving the next bestmove', async () => {
  let searches = 0
  const { bot, worker } = setup({}, { onCommand: (command, instance) => {
    if (command.startsWith('go ')) { searches++; if (searches === 2) queueMicrotask(() => instance.emit('bestmove e7e5')) }
    if (command === 'stop') queueMicrotask(() => instance.emit('bestmove e2e4'))
  } })
  const firstGame = Game.initialStandard()
  const first = bot.choose(firstGame)
  const rejected = assert.rejects(first, { name: 'AbortError' })
  await bot.ready
  await turn()
  const nextGame = reduce(firstGame, Action.move(firstGame.board.pieceAt(6, 4).id, 4, 4))
  const next = await bot.choose(nextGame)
  await rejected
  assert.equal(next.id, 'PAWN-BLACK-1-4')
  assert.equal(next.row, 3)
  assert.equal(searches, 2)
  const stopIndex = worker.commands.indexOf('stop')
  assert.ok(stopIndex > worker.commands.findIndex((command) => command.startsWith('go ')))
  bot.stop()
})

test('stop settles loading and active work, and no late worker message can yield a move', async () => {
  const loading = setup({}, { autoHandshake: false })
  const pendingLoad = loading.bot.choose(Game.initialStandard())
  loading.bot.stop()
  await assert.rejects(pendingLoad, { name: 'AbortError' })
  await assert.rejects(loading.bot.ready, { name: 'AbortError' })
  const running = setup()
  const pendingMove = running.bot.choose(Game.initialStandard())
  await running.bot.ready
  await turn()
  running.bot.stop()
  running.worker.emit('bestmove e2e4')
  await assert.rejects(pendingMove, { name: 'AbortError' })
  assert.equal(running.worker.terminated, 1)
  await assert.rejects(running.bot.choose(Game.initialStandard()), { name: 'AbortError' })
})

test('worker load failures, missing skill support and invalid moves surface errors instead of falling back', async () => {
  const broken = setup({}, { autoHandshake: false })
  broken.worker.error()
  await assert.rejects(broken.bot.ready, /WebAssembly/)
  assert.equal(broken.statuses.at(-1).state, 'error')
  await assert.rejects(broken.bot.choose(Game.initialStandard()), /WebAssembly/)
  broken.bot.stop()
  assert.equal(broken.worker.terminated, 1)
  const unsupported = setup({}, { autoHandshake: false })
  unsupported.worker.emit('uciok')
  await assert.rejects(unsupported.bot.ready, /Skill Level/)
  unsupported.bot.stop()
  const illegal = setup({}, { onCommand: (command, worker) => { if (command.startsWith('go ')) queueMicrotask(() => worker.emit('bestmove e2e5')) } })
  await assert.rejects(illegal.bot.choose(Game.initialStandard()), /không hợp lệ/)
  assert.equal(illegal.statuses.at(-1).state, 'error')
  assert.equal(illegal.worker.terminated, 1)
  illegal.bot.stop()
})

test('a worker that never initializes fails promptly rather than leaving the turn stuck', async () => {
  const { bot, worker, statuses } = setup({ readyTimeoutMs: 10 }, { autoHandshake: false })
  await assert.rejects(bot.ready, /Tải Stockfish quá lâu/)
  assert.equal(worker.terminated, 1)
  assert.equal(statuses.at(-1).state, 'error')
  bot.stop()
})

test('a search that never completes is terminated and surfaced to the user', async () => {
  const { bot, worker, statuses } = setup({ searchTimeoutMs: 10 })
  await assert.rejects(bot.choose(Game.initialStandard()), /đúng hạn/)
  assert.equal(worker.terminated, 1)
  assert.equal(statuses.at(-1).state, 'error')
  bot.stop()
})
