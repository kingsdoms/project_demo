/**
 * @file toView.js
 * @author tuanca
 */

// (game, interaction) -> view: dữ liệu thuần để ui vẽ.
// ui chỉ đọc view này, không import core/, nên không cần biết Piece/Board/Game.

import { PieceType } from "../core/constants/PieceType.js";
import { isInCheck } from "../core/moves/squares.js";
import { Game } from "../core/models/Game.js";
import { getLegalMoves } from "../core/engine/legalMoves.js";
import { PROMOTION_TARGETS } from "../core/constants/StandardDef.js";
import { Piece } from "../core/models/Piece.js";

/**
 * Kiểm tra nước đi có phải là nước bắt quân hay không,
 * bao gồm cả trường hợp bắt tốt qua đường (en passant).
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ đang thực hiện nước đi.
 * @param {number} row - Hàng của ô đích.
 * @param {number} col - Cột của ô đích.
 * @returns {boolean} true nếu nước đi bắt quân, ngược lại là false.
 */
function isCapture(game, piece, row, col) {
  if (game.board.pieceAt(row, col)) return true;
  const ep = game.enPassantTarget;
  return (
    piece.type === PieceType.PAWN &&
    ep != null &&
    ep.row === row &&
    ep.col === col
  );
}

/**
 * Chuyển trạng thái Game và lựa chọn hiện tại thành dữ liệu View.
 *
 * @param {Game} game - Trạng thái ván cờ.
 * @param {{ selectedId: string | null }} ix - Trạng thái lựa chọn quân cờ.
 * @param {(game: Game) => boolean} canAct - Kiểm tra người chơi hiện tại có được phép thực hiện hành động hay không.
 */

export function toView(game, ix, canAct) {
  const { board } = game;

  const selected =
    ix.selectedId != null ? board.pieceById(ix.selectedId) : null;
  const targets = selected
    ? getLegalMoves(game, selected).map(({ row, col }) => ({
        row,
        col,
        capture: isCapture(game, selected, row, col),
      }))
    : [];

  const king = board.pieces.find(
    (p) => p.type === PieceType.KING && p.side === game.turn,
  );
  const checkedKing =
    king && isInCheck(board, game.turn)
      ? { row: king.row, col: king.col }
      : null;

  const pawn =
    game.pendingPromotion != null
      ? board.pieceById(game.pendingPromotion)
      : null;
  const promotion = pawn
    ? {
        pieceId: pawn.id,
        side: pawn.side,
        row: pawn.row,
        col: pawn.col,
        options: PROMOTION_TARGETS,
      }
    : null;

  return {
    rows: board.rows,
    cols: board.cols,
    pieces: board.pieces,
    turn: game.turn,
    selectedId: selected ? selected.id : null,
    targets,
    checkedKing,
    promotion,
    result: game.result ?? null,
    canAct: canAct(game), // người dùng có được thao tác lúc này không (không phải lượt bot, chưa hết ván)
  };
}
