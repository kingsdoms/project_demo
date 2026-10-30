/**
 * @file outcome.js
 * @author tuanca
 */

// Kết quả ván: chỉ đọc, không đổi state.
// reduce là nơi duy nhất ghi kết quả vào game.result.

import { OutcomeType } from "../constants/OutcomeType.js";
import { PieceType } from "../constants/PieceType.js";
import { OPPONENT } from "../constants/Side.js";
import { hasLegalMove } from "./legalMoves.js";
import { isInCheck } from "../moves/squares.js";

/**
 * @typedef {import("../models/Board.js").Board} Board
 * @typedef {import("../models/Game.js").Game} Game
 * @typedef {import("../constants/Side.js").SideValue} SideValue
 */

/**
 * Kiểm tra bàn cờ có rơi vào trường hợp không đủ quân để chiếu hết hay không.
 *
 * Các trường hợp được xem là không đủ quân:
 * - Chỉ còn hai vua.
 * - Hai vua và chỉ có thêm một tượng hoặc một mã.
 * - Hai vua và các tượng còn lại đều đứng trên cùng màu ô.
 *
 * @param {Board} board - Bàn cờ cần kiểm tra.
 * @returns {boolean} `true` nếu không đủ quân để chiếu hết, ngược lại là `false`.
 */
function hasInsufficientMaterial(board) {
  const others = board.pieces.filter((p) => p.type !== PieceType.KING);
  if (others.length === 0) return true;
  if (others.length === 1)
    return (
      others[0].type === PieceType.BISHOP || others[0].type === PieceType.KNIGHT
    );
  if (others.every((p) => p.type === PieceType.BISHOP)) {
    const color = (others[0].row + others[0].col) % 2;
    return others.every((p) => (p.row + p.col) % 2 === color);
  }
  return false;
}

/**
 * Đánh giá trạng thái kết thúc của ván cờ hiện tại, cho bên đang tới lượt.
 *
 * Chỉ gọi khi `game.result` còn là `null` và không có tốt chờ phong cấp, vì
 * `hasLegalMove` dùng `validate` (gồm check `gameNotOver`, `noPromotionPending`).
 *
 * Thứ tự xét:
 * - `CHECKMATE`: bên đang tới lượt hết nước đi và đang bị chiếu.
 * - `STALEMATE`: bên đang tới lượt hết nước đi nhưng không bị chiếu.
 * - `INSUFFICIENT_MATERIAL`: không đủ quân để chiếu hết.
 *
 * @param {Game} game - Trạng thái ván cờ cần đánh giá.
 * @returns {import("../models/Game.js").OutcomeResult | null} Kết quả nếu ván đã kết thúc, hoặc `null` nếu ván vẫn tiếp tục.
 */
export function evaluateOutcome(game) {
  const side = game.turn;

  if (!hasLegalMove(game)) {
    return isInCheck(game.board, side)
      ? Object.freeze({
          type: OutcomeType.CHECKMATE,
          winner: OPPONENT[side],
        })
      : Object.freeze({ type: OutcomeType.STALEMATE, winner: null });
  }

  if (hasInsufficientMaterial(game.board))
    return Object.freeze({
      type: OutcomeType.INSUFFICIENT_MATERIAL,
      winner: null,
    });

  return null;
}