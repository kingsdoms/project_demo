/**
 * @file reduce.js
 * @author tuanca
 */
// Xử lý action và tạo trạng thái mới theo luật.
// reduce(game, action) → Game mới. Hàm thuần: không giữ biến, không đổi game cũ.
// Sai luật thì ném GameError (lỗi do rule ném ra), nên không có Game mới và room giữ nguyên state.
// Đây là nơi duy nhất ghi game.result.
//
// Luồng của MOVE: tìm quân → phân loại nước → dựng input → check từng rule → applyMove → tính kết quả.
// Luồng của PROMOTE: tìm quân → dựng input → check rule PROMOTE → applyPromotion → tính kết quả.

import { GameError } from "../../utils/GameError.js";
import { ActionType } from "../constants/ActionType.js";
import { ErrorCode } from "../constants/ErrorCode.js";
import { applyMove, applyPromotion } from "./applyAction.js";
import { PROMOTE_RULES, RULES_BY_KIND, ruleSet } from "./compose.js";

import {
  buildMoveInput,
  buildPromoteInput,
  classifyMove,
  evaluateOutcome,
} from "./moveFacts.js";

/**
 * @typedef {import("../models/Game.js").Game} Game
 * @typedef {import("../models/Action.js").Action} Action
 */

/**
 * Áp dụng action lên game hiện tại và trả về trạng thái game mới.
 *
 * @param {Game} game - Trạng thái game hiện tại.
 * @param {Action} action - Hành động cần thực hiện.
 * @returns {Game} Trạng thái game sau khi áp dụng hành động.
 */
export function reduce(game, action) {
  const piece = game.board.pieceById(action.id);
  if (piece === null)
    throw new GameError(ErrorCode.INVALID_ID, `Không có quân ${action.id}`);
  //

  if (action.type == ActionType.MOVE) {
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

    const input = buildPromoteInput(game, piece, action);
    for (const key of PROMOTE_RULES) ruleSet.get(key).check(input);
    return settle(applyPromotion(game, pType));
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
