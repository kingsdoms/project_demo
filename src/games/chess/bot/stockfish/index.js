import { Action } from '../../core/models/Action.js'
import { getAllLegalMoves } from '../../core/engine/legalMoves.js'
import { gameToFen, parseUciMove } from './position.js'
import { getBotLevel } from './levels.js'

export { BOT_LEVELS, getBotLevel } from './levels.js'
export { gameToFen, parseUciMove } from './position.js'

function abortError() {
  const error = new Error('Đã hủy lượt suy nghĩ Stockfish.')
  error.name = 'AbortError'
  return error
}

function defaultWorkerFactory(url, options) {
  if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') {
    throw new Error('Trình duyệt chưa hỗ trợ Web Worker và WebAssembly để chạy Stockfish.')
  }
  return new Worker(url, options)
}

/**
 * A session-owned, single-thread Stockfish worker. All searches are serialized:
 * an interrupted search must deliver its final bestmove before another begins.
 * No failed engine is silently replaced by the former random/capture bot.
 */
export function createStockfishBot({ level = 'medium', onStatus, workerFactory = defaultWorkerFactory, readyTimeoutMs = 30000, searchTimeoutMs } = {}) {
  const preset = getBotLevel(level)
  const base = import.meta.env?.BASE_URL || '/'
  const workerUrl = (base.endsWith('/') ? base : base + '/') + 'stockfish/stockfish.js'
  let worker = null
  let terminated = false
  let stopped = false
  let failure = null
  let configured = false
  let initialized = false
  let active = null
  let requestId = 0
  let queue = Promise.resolve()
  let promotion = null
  let engineName = 'Stockfish'
  const options = new Set()
  let resolveReady
  let rejectReady
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject })
  // The worker starts loading before the first bot turn. Keep errors observable
  // via ready/choose/status, without producing an unhandled startup rejection.
  ready.catch(() => {})

  function report(state, message) {
    try { onStatus?.({ state, message, level: preset.key, engineName }) } catch { /* UI callbacks must not corrupt UCI state. */ }
  }
  function send(command) { if (!terminated) worker?.postMessage(command) }
  function terminateWorker() {
    if (terminated) return
    terminated = true
    worker?.terminate()
  }
  function finishSearch(error, result) {
    if (!active) return
    const search = active
    active = null
    clearTimeout(search.timer)
    if (error) search.reject(error)
    else search.resolve(result)
  }
  function fail(error) {
    if (stopped || failure) return
    failure = error instanceof Error ? error : new Error(String(error))
    clearTimeout(startupTimer)
    rejectReady(failure)
    finishSearch(failure)
    terminateWorker()
    report('error', failure.message)
  }
  function handleLine(line) {
    if (stopped || failure) return
    line = line.trim()
    if (!line) return
    if (/CRITICAL ERROR|RuntimeError|Aborted\(/i.test(line)) { fail(new Error('Stockfish không thể xử lý thế cờ: ' + line.slice(0, 180))); return }
    if (line.startsWith('id name ')) engineName = line.slice(8).trim()
    const option = /^option name (.+?) type /.exec(line)
    if (option) options.add(option[1])
    if (line === 'uciok' && !configured) {
      if (!options.has('Skill Level')) { fail(new Error('Bản Stockfish này không hỗ trợ cấu hình Skill Level.')); return }
      configured = true
      for (const [name, value] of [['Threads', 1], ['Hash', 16], ['Ponder', false], ['UCI_Chess960', false], ['UCI_LimitStrength', false], ['Skill Level', preset.skill]]) {
        if (options.has(name)) send('setoption name ' + name + ' value ' + value)
      }
      send('ucinewgame')
      send('isready')
    }
    if (line === 'readyok' && configured && !initialized) {
      initialized = true
      clearTimeout(startupTimer)
      resolveReady()
      report('ready', 'Stockfish đã sẵn sàng · ' + preset.label)
    }
    if (line.startsWith('bestmove ') && active) {
      if (active.cancelled) { finishSearch(abortError()); return }
      try {
        const result = parseUciMove(active.game, line.split(/\s+/)[1])
        promotion = result?.promotion || null
        finishSearch(null, result?.action || null)
        report('ready', 'Stockfish đã chọn nước · ' + preset.label)
      } catch (error) { fail(error) }
    }
  }
  function handleMessage(event) {
    const chunks = Array.isArray(event.data) ? event.data.flat(Infinity) : [event.data]
    for (const chunk of chunks) if (typeof chunk === 'string') for (const line of chunk.split(/\r?\n/)) handleLine(line)
  }
  const startupTimer = setTimeout(() => fail(new Error('Tải Stockfish quá lâu. Hãy kiểm tra kết nối hoặc tải lại ván.')), readyTimeoutMs)
  report('loading', 'Đang tải Stockfish trên thiết bị…')
  try {
    worker = workerFactory(workerUrl, { type: 'classic', name: 'chessarena-stockfish' })
    worker.addEventListener('message', handleMessage)
    worker.addEventListener('error', (event) => { event.preventDefault?.(); fail(new Error(event.message || 'Không tải được Stockfish. Hãy kiểm tra tệp engine và WebAssembly.')) })
    worker.addEventListener('messageerror', () => fail(new Error('Không đọc được phản hồi từ Stockfish.')))
    send('uci')
  } catch (error) { fail(error) }

  function choose(game) {
    const id = ++requestId
    if (stopped) return Promise.reject(abortError())
    if (failure) return Promise.reject(failure)
    if (active && !active.cancelled) { active.cancelled = true; send('stop') }
    const work = queue.then(async () => {
      await ready
      if (stopped || id !== requestId) throw abortError()
      if (failure) throw failure
      if (game.result !== null) return null
      if (game.pendingPromotion !== null) {
        const pawn = game.board.pieceById(game.pendingPromotion)
        if (!promotion || !pawn || pawn.side !== promotion.side || pawn.row !== promotion.row || pawn.col !== promotion.col) {
          throw new Error('Không tìm thấy lựa chọn phong cấp tương ứng của Stockfish.')
        }
        const type = promotion.type
        promotion = null
        return Action.promote(type)
      }
      promotion = null
      if (!getAllLegalMoves(game).length) return null
      const fen = gameToFen(game)
      return new Promise((resolve, reject) => {
        active = {
          game, resolve, reject, cancelled: false,
          timer: setTimeout(() => fail(new Error('Stockfish chưa trả nước đi đúng hạn. Hãy tải lại ván để thử lại.')), searchTimeoutMs ?? preset.moveTime + 10000),
        }
        report('thinking', 'Stockfish đang suy nghĩ · ' + preset.label)
        try {
          send('position fen ' + fen)
          send('go depth ' + preset.depth + ' movetime ' + preset.moveTime)
        } catch (error) { fail(error) }
      })
    }).catch((error) => {
      if (error.name !== 'AbortError') fail(error)
      throw error
    })
    queue = work.catch(() => {})
    return work
  }

  function stop() {
    if (stopped) return
    stopped = true
    requestId++
    promotion = null
    clearTimeout(startupTimer)
    rejectReady(abortError())
    finishSearch(abortError())
    try { send('stop'); send('quit') } catch { /* Terminate still owns final cleanup. */ }
    terminateWorker()
    report('stopped', 'Đã dừng Stockfish.')
  }

  return Object.freeze({ choose, stop, ready })
}
