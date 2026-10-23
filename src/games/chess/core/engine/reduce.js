/**
 * @file reduce.js
 * @author tuanca
 */

import { GameError } from "../../utils/GameError.js";
import { ActionType } from "../constants/ActionType.js";
import { ErrorCode } from "../constants/ErrorCode.js";
import { applyMove, applyPromotion } from "./applyMoves.js";
import { PROMOTE_RULES, RULES_BY_KIND, ruleSet } from "./ruleset.js";

import {
  buildMoveInput,
  buildPromoteInput,
  classifyMove,
} from "./buildMoves.js";
import { evaluateOutcome } from "./outcome.js";

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
 * - Ném GameError nếu action vi phạm luật do rule phát hiện.
 *   Khi đó không có Game mới được tạo ra và Room giữ nguyên state hiện tại.
 *
 * Đây là nơi duy nhất chịu trách nhiệm cập nhật game.result,
 * tức kết quả của ván cờ.
 *
 * Luồng xử lý action:
 *
 * 1. MOVE:
 *    - Tìm quân cờ cần di chuyển.
 *    - Phân loại nước đi.
 *    - Xây dựng input cho các rule.
 *    - Kiểm tra lần lượt các rule liên quan.
 *    - Áp dụng nước đi bằng applyMove.
 *    - Tính toán và cập nhật kết quả ván cờ.
 *
 * 2. PROMOTE:
 *    - Tìm quân tốt cần phong cấp.
 *    - Xây dựng input cho rule.
 *    - Kiểm tra rule PROMOTE.
 *    - Áp dụng phong cấp bằng applyPromotion.
 *    - Tính toán và cập nhật kết quả ván cờ.
 *
 * @param {Game} game - Trạng thái game hiện tại.
 * @param {Action} action - Hành động cần thực hiện.
 * @returns {Game} Trạng thái game sau khi áp dụng hành động.
 */
export function reduce(game, action) {
  //
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

    const kind = classifyMove(game, piece, row, col);
    const input = buildMoveInput(game, piece, row, col, kind);

    for (const key of RULES_BY_KIND[kind]) ruleSet.get(key).check(input);
    return settle(applyMove(game, piece, row, col, kind));
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

    const input = buildPromoteInput(game,piece, action);
    console.log(input);
    for (const key of PROMOTE_RULES) ruleSet.get(key).check(input);
    return settle(applyPromotion(game,piece, pType));
  }
}

/**
 * Tính kết quả ván đấu cho bên sắp đi.
 * Không xác định kết quả khi game đang chờ phong cấp.
 *
 * @param {Game} game
 * @returns {Game}
 */
function settle(game) {
  if (game.pendingPromotion !== null) return game;
  const result = evaluateOutcome(game);
  return result === null ? game : game.with({ result: result });
}
