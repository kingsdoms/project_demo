/**
 * @file outcome.js
 * @author tuanca
 */
 
// Kết quả ván: tính các sự thật về thế cờ (position.inCheck, ...) rồi hỏi outcomeRules.
// Chỉ đọc, không đổi state. reduce là nơi duy nhất ghi kết quả vào game.result.
 
import { lazy } from "../../utils/lazy.js";
import { OutcomeType } from "../constants/OutcomeType.js";
import { PieceType } from "../constants/PieceType.js";
import { OPPONENT, Side } from "../constants/Side.js";
import { hasLegalMove } from "./legalMoves.js";
import { ruleSet } from "./ruleset.js";
import { isInCheck } from "./squaresMoves.js";

/**
 * @typedef {import("../models/Piece.js").Piece} Piece
 * @typedef {import("../models/Game.js").Game} Game
 * @typedef {import("../models/Board.js").Board} Board
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
 * Đánh giá trạng thái kết thúc của ván cờ hiện tại.
 *
 * Chỉ gọi khi `game.result` còn là `null`, vì `hasLegalMove()` sử dụng
 * rule `GAME_NOT_OVER` để kiểm tra nước đi hợp lệ.
 *
 * Xác định các trường hợp:
 * - `checkmate`: bên đang tới lượt bị chiếu hết.
 * - `stalemate`: bên đang tới lượt không còn nước hợp lệ nhưng không bị chiếu.
 * - `insufficientMaterial`: không đủ quân để chiếu hết.
 *
 * Trả về `null` nếu ván đấu vẫn có thể tiếp tục.
 *
 * @param {Game} game - Trạng thái ván cờ cần đánh giá.
 * @returns {{ type: OutcomeType[keyof typeof OutcomeType], winner: typeof Side[keyof typeof Side] | null } | null}
 * Kết quả ván đấu nếu đã kết thúc, hoặc `null` nếu ván vẫn tiếp tục.
 */
export function evaluateOutcome(game) {
  const side = game.turn;
  const facts = {
    position: lazy({
      inCheck: () => isInCheck(game.board, side),
      hasLegalMove: () => hasLegalMove(game),
      insufficientMaterial: () => hasInsufficientMaterial(game.board),
    }),
  };

  for (const key of Object.values(OutcomeType)) {
    const rule = ruleSet.get(key);
    if (!rule) throw new Error(`Rule "${key}" chưa được đăng ký`);

    if (rule.test(facts)) {
      return Object.freeze({
        type: key,
        winner: key === OutcomeType.CHECKMATE ? OPPONENT[side] : null,
      });
    }
  }
  return null;
}