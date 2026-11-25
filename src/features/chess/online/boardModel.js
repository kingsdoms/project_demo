// These helpers describe server data and presentation only. Chess moves always come
// from view.legal_moves; this module never derives moves from piece geometry.
export const posKey = (pos) => `${pos?.row},${pos?.col}`
export const samePos = (a, b) => Boolean(a && b && a.row === b.row && a.col === b.col)

export function squareName(pos, rows = 8) {
  if (!pos) return ''
  let file = ''
  let col = pos.col + 1
  while (col > 0) { file = String.fromCharCode(97 + (col - 1) % 26) + file; col = Math.floor((col - 1) / 26) }
  return `${file}${rows - pos.row}`
}

export function visualPosition(pos, view) {
  return view?.you === 'BLACK'
    ? { row: view.rows - 1 - pos.row, col: view.cols - 1 - pos.col }
    : { ...pos }
}

export function legalTargets(view, selectedId) {
  if (!view || view.phase !== 'PLAYING' || view.result || view.pending_promotion != null || view.turn !== view.you) return []
  return (view.legal_moves || []).filter((move) => move.piece === selectedId)
}

export function selectablePieceIds(view) {
  if (!view || view.phase !== 'PLAYING' || view.result || view.turn !== view.you || view.pending_promotion != null) return new Set()
  const ownIds = new Set((view.pieces || []).filter((piece) => piece.side === view.you).map((piece) => piece.id))
  return new Set((view.legal_moves || []).filter((move) => ownIds.has(move.piece)).map((move) => move.piece))
}

export function moveNeedsPromotion(view, move) {
  const piece = view?.pieces?.find((candidate) => candidate.id === move?.piece)
  return Boolean(piece?.kind === 'PAWN' && (move.to.row === 0 || move.to.row === view.rows - 1))
}

export function pendingPromotionPiece(view) {
  const pending = view?.pending_promotion
  if (pending == null) return null
  const id = typeof pending === 'object' ? (pending.piece?.id ?? pending.piece ?? pending.id) : pending
  const piece = view.pieces?.find((candidate) => candidate.id === id)
  return piece?.side === view.you ? piece : null
}

export function getAbilityTargets(view) {
  const player = view?.ext?.players?.find((entry) => entry.side === view.you)
  if (!player?.character || view.phase !== 'PLAYING' || view.turn !== view.you || view.result || view.pending_promotion != null || view.ext.round < player.ability_ready_at) return []
  const pieces = view.pieces || []
  const occupied = new Set(pieces.map((piece) => posKey(piece.pos)))
  if (player.character === 'frost_witch') {
    return pieces.filter((piece) => piece.side !== view.you && piece.kind !== 'KING').map((piece) => piece.pos)
  }
  if (player.character === 'commander') {
    const direction = view.you === 'WHITE' ? -1 : 1
    return pieces.filter((piece) => {
      const nextRow = piece.pos.row + direction
      return piece.side === view.you && piece.kind === 'PAWN' && nextRow > 0 && nextRow < view.rows - 1 && !occupied.has(posKey({ row: nextRow, col: piece.pos.col }))
    }).map((piece) => piece.pos)
  }
  const squares = Array.from({ length: view.rows * view.cols }, (_, i) => ({ row: Math.floor(i / view.cols), col: i % view.cols }))
  // Future characters can still submit targets for the server to validate.
  return player.character === 'geomancer' ? squares.filter((pos) => !occupied.has(posKey(pos))) : squares
}

export const EFFECT_INFO = {
  cracked: { name: 'Nứt', icon: 'ϟ', description: 'Vòng sau ô sẽ vỡ.' },
  broken: { name: 'Vỡ', icon: '◉', description: 'Không đi qua được; bước vào sẽ mất quân.' },
  cold: { name: 'Lạnh', icon: '❄', description: 'Quân bước vào bị chậm.' },
  ice: { name: 'Băng', icon: '❖', description: 'Quân bước vào trượt thêm một ô.' },
  slowed: { name: 'Chậm', icon: '⌛', description: 'Quân bị hạn chế di chuyển.' },
  frozen: { name: 'Đóng băng', icon: '❄', description: 'Quân tạm thời không thể di chuyển.' },
}

export function visibleEffects(view) {
  return (view?.ext?.effects || []).filter((effect) => effect.effect !== 'skid')
}

export function effectText(effect, round = 0) {
  const info = EFFECT_INFO[effect.effect]
  const duration = effect.expires == null ? 'cả trận' : `còn ${Math.max(0, effect.expires - round)} vòng`
  return `${info?.name || effect.effect} · ${duration}${info?.description ? `. ${info.description}` : ''}`
}

export function pieceEffectId(effect) {
  return effect.target?.piece?.id ?? effect.target?.piece ?? effect.target?.id
}

export function unwrapBoardEvent(event) {
  return event.type === 'GAME' ? event.event : event
}

const eventPieceId = (piece) => typeof piece === 'object' ? piece?.id : piece
const copyPieces = (pieces = []) => pieces.map((piece) => ({ ...piece, pos: { ...piece.pos } }))

// Intermediate frames are cosmetic and never replace the authoritative view used
// for selection, legal destinations, promotions, or outgoing messages.
export function buildAnimationFrames(previous, next, events = []) {
  if (!previous || previous.rows !== next?.rows || previous.cols !== next?.cols) return []
  let pieces = copyPieces(previous.pieces)
  const frames = []
  for (const raw of events) {
    const event = unwrapBoardEvent(raw)
    if (!event) continue
    pieces = pieces.filter((piece) => !piece.exit)
    const id = eventPieceId(event.type === 'CASTLED' ? event.rook : event.piece)
    if (['MOVED', 'CASTLED', 'PIECE_MOVED'].includes(event.type) && event.to) {
      pieces = pieces.map((piece) => piece.id === id ? { ...piece, pos: { ...event.to } } : piece)
      frames.push({ pieces: copyPieces(pieces), signal: null })
    } else if (['CAPTURED', 'PIECE_REMOVED'].includes(event.type)) {
      pieces = pieces.map((piece) => piece.id === id ? { ...piece, exit: event.type === 'CAPTURED' ? 'captured' : 'removed' } : piece)
      frames.push({ pieces: copyPieces(pieces), signal: null })
    } else if (event.type === 'PROMOTED') {
      pieces = pieces.map((piece) => piece.id === id ? { ...piece, kind: event.kind } : piece)
      frames.push({ pieces: copyPieces(pieces), signal: null })
    } else if (event.type === 'SIGNAL' || event.type === 'ABILITY_USED') {
      frames.push({ pieces: copyPieces(pieces), signal: { pos: event.pos || event.target, name: event.name || event.character || event.effect } })
    }
  }
  return frames
}

export function createBoardAnimationStore(initialView, { schedule = setTimeout, cancel = clearTimeout, frameMs = 240 } = {}) {
  let snapshot = { pieces: initialView?.pieces || [], signal: null, animating: false }
  let previous = initialView
  let timer = null
  let generation = 0
  const listeners = new Set()
  const publish = (next) => { snapshot = next; listeners.forEach((listener) => listener()) }
  const stop = () => { generation++; if (timer != null) cancel(timer); timer = null }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    update(view, events = []) {
      const interrupted = snapshot.animating
      stop()
      const frames = interrupted ? [] : buildAnimationFrames(previous, view, events)
      const startPieces = previous?.pieces || []
      previous = view
      if (!view || !frames.length) {
        publish({ pieces: view?.pieces || [], signal: null, animating: false })
        return
      }
      const token = generation
      publish({ pieces: startPieces, signal: null, animating: true })
      let index = 0
      const advance = () => {
        if (token !== generation) return
        if (index < frames.length) {
          publish({ ...frames[index++], animating: true })
          timer = schedule(advance, frameMs)
        } else {
          timer = null
          publish({ pieces: view.pieces || [], signal: null, animating: false })
        }
      }
      timer = schedule(advance, 16)
    },
    stop,
  }
}
