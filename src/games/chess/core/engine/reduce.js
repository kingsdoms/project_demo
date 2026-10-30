/**
 * @file reduce.js
 * @author tuanca
 */

import { GameError } from "../../utils/GameError.js";
import { ActionType } from "../constants/ActionType.js";
import { ErrorCode } from "../constants/ErrorCode.js";
import { evaluateOutcome } from "./outcome.js";
import {
  findMove,
  validate,
  validatePromotion,
  applyPromotion,
} from "../moves/index.js";

/**
 * @typedef {import("../models/Game.js").Game} Game
 * @typedef {import("../models/Action.js").Action} Action
 */

/**
 * Xử lý action theo luật cờ vua và tạo ra trạng thái game mới.
 *
 * reduce(game, action) → Game mới.
 *
 * Đây là hàm thuần (pure function):
 * - Không lưu trữ state nội bộ giữa các lần gọi.
 * - Không thay đổi object game ban đầu.
 * - Trả về một Game mới nếu action hợp lệ.
 * - Ném GameError nếu action vi phạm luật do `validate` phát hiện.
 *   Khi đó không có Game mới được tạo ra và Room giữ nguyên state hiện tại.
 *
 * Đây là nơi duy nhất chịu trách nhiệm cập nhật game.result,
 * tức kết quả của ván cờ.
 *
 * Luồng xử lý action:
 *
 * 1. MOVE:
 *    - Tìm quân cờ cần di chuyển.
 *    - Tìm loại nước đi phù hợp bằng `findMove`.
 *    - Xác thực bằng `validate` (check chung, rồi check riêng của loại nước đi).
 *    - Áp dụng nước đi bằng `move.apply`.
 *    - Tính toán và cập nhật kết quả ván cờ.
 *
 * 2. PROMOTE:
 *    - Tìm quân tốt đang chờ phong cấp.
 *    - Xác thực bằng `validatePromotion`.
 *    - Áp dụng phong cấp bằng `applyPromotion`.
 *    - Tính toán và cập nhật kết quả ván cờ.
 *
 * @param {Game} game - Trạng thái game hiện tại.
 * @param {Action} action - Hành động cần thực hiện.
 * @returns {Game} Trạng thái game sau khi áp dụng hành động.
 * @throws {GameError} Nếu action thiếu dữ liệu hoặc vi phạm luật.
 */
export function reduce(game, action) {
  if (action.type == ActionType.MOVE) {
    const piece = game.board.pieceById(action.id);
    if (piece === null)
      throw new GameError(ErrorCode.INVALID_ID, `Không có quân ${action.id}`);
    const { row, col } = action;
    if (row === null || col === null)
      throw new GameError(
        ErrorCode.INVALID_ARGUMENT,
        "MOVE action phải có row và col",
      );

    const move = findMove(game, piece, row, col);
    if (move === undefined)
      throw new GameError(
        ErrorCode.BAD_ACTION,
        "Không có loại nước đi phù hợp",
      );

    const error = validate(move, game, piece, row, col);
    if (error) throw error;

    return settle(move.apply(game, piece, row, col));
  } else {
    const pType = action.pieceType;
    if (pType === null)
      throw new GameError(
        ErrorCode.INVALID_ARGUMENT,
        "pieceType không được trống",
      );
    const id = game.pendingPromotion;
    if (id === null)
      throw new GameError(
        ErrorCode.BAD_ACTION,
        "Không có tốt nào đang chờ phong cấp",
      );

    const piece = game.board.pieceById(id);
    if (piece === null)
      throw new GameError(
        ErrorCode.BAD_ACTION,
        `Không tìm thấy quân ${id} đang chờ phong cấp`,
      );

    const error = validatePromotion(game, piece, pType);
    if (error) throw error;

    return settle(applyPromotion(game, piece, pType));
  }
}

/**
 * Tính kết quả ván đấu cho bên sắp đi.
 * Không xác định kết quả khi game đang chờ phong cấp.
 *
 * @param {Game} game - Game sau khi áp dụng hành động.
 * @returns {Game} Game có `result` nếu ván đã kết thúc, ngược lại giữ nguyên.
 */
function settle(game) {
  if (game.pendingPromotion !== null) return game;
  const result = evaluateOutcome(game);
  return result === null ? game : game.with({ result });
}