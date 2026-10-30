/**
 * @file finish.js
 * @author tuanca
 */
import { OPPONENT } from "../constants/Side.js";

/**
 * @typedef {import("../models/Game.js").Game} Game
 * @typedef {import("../models/Board.js").Board} Board
 * @typedef {import("../models/Square.js").Square} Square
 * @typedef {import("../constants/Side.js").SideValue} SideValue
 */

/**
 * Hoàn tất nước đi bằng cách cập nhật các trạng thái chung của game.
 * Chưa đổi lượt nếu game đang chờ phong cấp.
 *
 * @param {Game} game - Trạng thái ván cờ trước nước đi.
 * @param {Board} board - Bàn cờ sau nước đi.
 * @param {SideValue} side - Bên vừa đi.
 * @param {Square | null} enPassantTarget - Ô tốt vừa bỏ qua khi đi 2 ô, hoặc `null`.
 * @param {string | null} pendingPromotion - Id tốt đang chờ phong cấp, hoặc `null`.
 * @returns {Game} Game mới, `game` truyền vào không bị thay đổi.
 */
export function finish(game, board, side, enPassantTarget, pendingPromotion) {
  const next = game.with({ board, enPassantTarget, pendingPromotion });
  return pendingPromotion === null ? next.with({ turn: OPPONENT[side] }) : next;
}