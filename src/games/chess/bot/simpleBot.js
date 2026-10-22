/**
 * @file simpleBot.js
 * @author tuanca
 */

// Bot v1.1: ưu tiên ăn quân có giá trị cao nhất, không có nước ăn thì đi ngẫu nhiên.
// Khi tốt của bot vừa tới hàng cuối (game.pendingPromotion khác null), lượt vẫn thuộc bot,
import { Action } from "../core/models/Action.js";
import { PieceType } from "../core/constants/PieceType.js";
import { MoveKind } from "../core/constants/MoveKind.js";
import { PIECE_DEFS } from "../core/constants/PieceDefs.js";
import { getAllLegalMoves } from "../core/engine/legalMoves.js";

/**
 * @typedef {import("../core/models/Game.js").Game} Game
 * @typedef {import("../core/models/Action.js").Action} ActionT
 */

/**
 * Giá trị quân bị ăn bởi một nước đi. Bắt tốt qua đường: tốt bị ăn không nằm
 * ở ô đích mà nằm cùng hàng với tốt đi, cùng cột với ô đích.
 *
 * @param {Game} game
 * @param {{ id: string, row: number, col: number, kind: string }} move
 * @returns {number}
 */
function captureValue(game, move) {
  const board = game.board;
  if (move.kind === MoveKind.EN_PASSANT) return PIECE_DEFS[PieceType.PAWN].value;
  const target = board.pieceAt(move.row, move.col);
  return target === null ? 0 : PIECE_DEFS[target.type].value;
}

/**
 * Tạo bot. `rng` cho phép thay Math.random bằng hàm có hạt giống khi test.
 *
 * @param {{ rng?: () => number }} [options]
 * @returns {(game: Game) => ActionT | null}
 */
export function createSimpleBot({ rng = Math.random } = {}) {
  const pick = (list) => list[Math.floor(rng() * list.length)];

  return function chooseBotAction(game) {
    if (game.result !== null) return null;

    // Phong cấp: luôn chọn hậu
    if (game.pendingPromotion !== null) return Action.promote(PieceType.QUEEN);

    const moves = getAllLegalMoves(game);
    if (moves.length === 0) return null;

    let best = 0;
    let bestMoves = [];
    for (const m of moves) {
      const v = captureValue(game, m);
      if (v > best) {
        best = v;
        bestMoves = [m];
      } else if (v === best && v > 0) {
        bestMoves.push(m);
      }
    }

    const chosen = best > 0 ? pick(bestMoves) : pick(moves);
    return Action.move(chosen.id, chosen.row, chosen.col);
  };
}

export const chooseBotAction = createSimpleBot();
export default chooseBotAction;