import { Game } from '../../games/chess/core/models/Game.js'
import { Action } from '../../games/chess/core/models/Action.js'
import { reduce } from '../../games/chess/core/engine/reduce.js'

export const SAMPLE_MOVES = [
  ['e2', 'e4', 'e4'], ['e7', 'e5', 'e5'],
  ['g1', 'f3', 'Nf3'], ['b8', 'c6', 'Nc6'],
  ['f1', 'b5', 'Bb5'], ['a7', 'a6', 'a6'],
  ['b5', 'a4', 'Ba4'], ['g8', 'f6', 'Nf6'],
  ['e1', 'g1', 'O-O'], ['f8', 'e7', 'Be7'],
  ['f1', 'e1', 'Re1'], ['b7', 'b5', 'b5'],
]

const square = (name) => ({ row: 8 - Number(name[1]), col: 'abcdefgh'.indexOf(name[0]) })
const notationSquare = ({ row, col }) => `${'abcdefgh'[col]}${8 - row}`

export function moveLabel(entry) {
  if (entry.notation) return entry.notation
  if (entry.kind === 'CASTLE') return entry.to.col > entry.from.col ? 'O-O' : 'O-O-O'
  return `${notationSquare(entry.from)}${entry.capture ? '×' : ' → '}${notationSquare(entry.to)}${entry.promotion ? `=${entry.promotion}` : ''}`
}

export const SAMPLE_HISTORY = SAMPLE_MOVES.map(([from, to, notation]) => ({
  from: square(from), to: square(to), notation,
}))

// Rebuild every frame with the same rule engine used during live local play.
export function buildReplay(history = SAMPLE_HISTORY) {
  let game = Game.initialStandard()
  const frames = [{ pieces: game.board.pieces, targets: [], lastMove: null }]
  for (const entry of history) {
    const piece = game.board.pieceAt(entry.from.row, entry.from.col)
    if (!piece) throw new Error('Không tìm thấy quân ở nước xem lại.')
    game = reduce(game, Action.move(piece.id, entry.to.row, entry.to.col))
    if (game.pendingPromotion) {
      if (!entry.promotion) break // An unfinished promotion is not yet a full move.
      game = reduce(game, Action.promote(entry.promotion))
    }
    frames.push({ pieces: game.board.pieces, targets: [], lastMove: entry })
  }
  return frames
}
