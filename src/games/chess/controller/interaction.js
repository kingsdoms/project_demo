/**
 * @file interaction.js
 * @author tuanca
 */

import { Game } from "../core/models/Game.js";
import { getLegalMoves } from "../core/engine/legalMoves.js";

/**
 * @typedef {Readonly<{
 *   selectedId: string | null
 * }>} Interaction
 */

/**
 * @type {Interaction}
 */
export const EMPTY = Object.freeze({ selectedId: null });

/**
 * Đồng bộ trạng thái tương tác với trạng thái Game hiện tại.
 * Xóa lựa chọn không còn hợp lệ sau khi Game thay đổi, chẳng hạn bot vừa đi,
 * ván đã kết thúc hoặc đang chờ phong cấp.
 * Giữ nguyên tham chiếu `ix` nếu trạng thái lựa chọn vẫn hợp lệ,
 * giúp phát hiện thay đổi bằng phép so sánh `===`.
 *
 * @param {Interaction} ix - Trạng thái tương tác hiện tại.
 * @param {Game} game - Trạng thái Game mới nhất.
 * @returns {Interaction} Trạng thái tương tác sau khi đồng bộ.
 */
export function syncInteraction(ix, game) {
  if (ix.selectedId == null) return ix;
  if (game.result != null || game.pendingPromotion != null) return EMPTY;
  const piece = game.board.pieceById(ix.selectedId);
  return piece && piece.side === game.turn ? ix : EMPTY;
}

/**
 * Người dùng bấm vào ô (row, col).
 *
 * @param {{selectedId: string|null}} ix
 * @param {Game} game
 * @param {{row: number, col: number}} square
 * @returns {{ ix: Interaction, intent: null | { id: string, row: number, col: number } }}
 */
export function click(ix, game, { row, col }) {
  if (game.result != null || game.pendingPromotion != null)
    return { ix: EMPTY, intent: null };

  // 1. Đang chọn quân và bấm vào ô đi được -> đi.
  if (ix.selectedId != null) {
    const selected = game.board.pieceById(ix.selectedId);
    if (
      selected !== null &&
      getLegalMoves(game, selected).some((t) => t.row === row && t.col === col)
    )
      return {
        ix: EMPTY,
        intent: { id: ix.selectedId, row, col },
      };
  }

  // 2. Bấm quân của bên đang đi -> chọn, hoặc bỏ chọn nếu bấm lại chính nó.
  const hit = game.board.pieceAt(row, col);
  if (hit && hit.side === game.turn) {
    return {
      ix: Object.freeze({
        selectedId: hit.id === ix.selectedId ? null : hit.id ,
      }),
      intent: null,
    };
  }

  // 3. Còn lại -> bỏ chọn.
  return { ix: EMPTY, intent: null };
}
