import { Action } from '../../core/models/Action.js'
import { PieceType } from '../../core/constants/PieceType.js'
import { Side } from '../../core/constants/Side.js'
import { getAllLegalMoves } from '../../core/engine/legalMoves.js'

const FEN_PIECES = Object.freeze({ PAWN: 'p', KNIGHT: 'n', BISHOP: 'b', ROOK: 'r', QUEEN: 'q', KING: 'k' })
const PROMOTIONS = Object.freeze({ q: PieceType.QUEEN, r: PieceType.ROOK, b: PieceType.BISHOP, n: PieceType.KNIGHT })
const FILES = 'abcdefgh'

const coordinate = (square) => {
  if (!Number.isInteger(square?.row) || !Number.isInteger(square?.col) || square.row < 0 || square.row > 7 || square.col < 0 || square.col > 7) {
    throw new Error('Tọa độ bàn cờ không hợp lệ cho Stockfish.')
  }
  return FILES[square.col] + (8 - square.row)
}

/** Serialize our immutable Game, including retained castling and en-passant rights. */
export function gameToFen(game) {
  if (game.board.rows !== 8 || game.board.cols !== 8) throw new Error('Stockfish chỉ hỗ trợ bàn cờ tiêu chuẩn 8 × 8.')
  if (game.pendingPromotion !== null) throw new Error('Cần hoàn tất phong cấp trước khi gửi thế cờ tới Stockfish.')
  if (![Side.WHITE, Side.BLACK].includes(game.turn)) throw new Error('Lượt đi không hợp lệ cho Stockfish.')
  for (const side of [Side.WHITE, Side.BLACK]) {
    if (game.board.pieces.filter((piece) => piece.side === side && piece.type === PieceType.KING).length !== 1) {
      throw new Error('Thế cờ gửi tới Stockfish phải có đúng một vua mỗi bên.')
    }
  }
  const rows = []
  for (let row = 0; row < 8; row++) {
    let encoded = ''
    let empty = 0
    for (let col = 0; col < 8; col++) {
      const piece = game.board.pieceAt(row, col)
      if (!piece) { empty++; continue }
      if (empty) { encoded += empty; empty = 0 }
      const letter = FEN_PIECES[piece.type]
      if (!letter || ![Side.WHITE, Side.BLACK].includes(piece.side)) throw new Error('Quân cờ không hợp lệ cho Stockfish.')
      encoded += piece.side === Side.WHITE ? letter.toUpperCase() : letter
    }
    if (empty) encoded += empty
    rows.push(encoded)
  }
  let castling = ''
  for (const [side, row, kingSide, queenSide] of [[Side.WHITE, 7, 'K', 'Q'], [Side.BLACK, 0, 'k', 'q']]) {
    const king = game.board.pieceAt(row, 4)
    if (king?.type !== PieceType.KING || king.side !== side || king.hasMoved) continue
    for (const [col, symbol] of [[7, kingSide], [0, queenSide]]) {
      const rook = game.board.pieceAt(row, col)
      if (rook?.type === PieceType.ROOK && rook.side === side && !rook.hasMoved) castling += symbol
    }
  }
  const ep = game.enPassantTarget ? coordinate(game.enPassantTarget) : '-'
  // Game does not currently retain the halfmove/fullmove counters or repetition
  // history. Use neutral counters here; move legality/outcomes stay with our reducer.
  return rows.join('/') + ' ' + (game.turn === Side.WHITE ? 'w' : 'b') + ' ' + (castling || '-') + ' ' + ep + ' 0 1'
}

/** Translate a UCI move into the app's two-stage move/promotion API. */
export function parseUciMove(game, uci) {
  if (game.pendingPromotion !== null) throw new Error('Không thể nhận nước Stockfish khi đang chờ phong cấp.')
  const legal = getAllLegalMoves(game)
  if (uci === '(none)' || uci === '0000') {
    if (!legal.length) return null
    throw new Error('Stockfish chưa trả nước đi dù ván còn nước hợp lệ.')
  }
  const match = /^([a-h])([1-8])([a-h])([1-8])([qrbn])?$/.exec(String(uci).trim())
  if (!match) throw new Error('Stockfish trả nước đi sai định dạng UCI.')
  const [, fromFile, fromRank, toFile, toRank, promotionCode] = match
  const from = { row: 8 - Number(fromRank), col: FILES.indexOf(fromFile) }
  const to = { row: 8 - Number(toRank), col: FILES.indexOf(toFile) }
  const piece = game.board.pieceAt(from.row, from.col)
  if (!piece || piece.side !== game.turn || !legal.some((move) => move.id === piece.id && move.row === to.row && move.col === to.col)) {
    throw new Error('Nước đi Stockfish không hợp lệ trong thế cờ hiện tại.')
  }
  const reachesPromotion = piece.type === PieceType.PAWN && (to.row === 0 || to.row === 7)
  if (reachesPromotion !== Boolean(promotionCode)) throw new Error('Thông tin phong cấp của Stockfish không hợp lệ.')
  return {
    action: Action.move(piece.id, to.row, to.col),
    promotion: promotionCode ? { side: piece.side, row: to.row, col: to.col, type: PROMOTIONS[promotionCode] } : null,
  }
}
