/**
 * @file reduce.js
 * @author tuanca
 */

// reduce(game, action) → Game mới. Hàm thuần: không giữ biến, không đổi game cũ.
// Sai luật thì ném GameError (lỗi do rule ném ra), nên không có Game mới và room giữ nguyên state.
// Đây là nơi duy nhất ghi game.result.
//
// Luồng của MOVE: tìm quân → phân loại nước → dựng input → check từng rule → applyMove → tính kết quả.
// Luồng của PROMOTE: tìm quân → dựng input → check rule PROMOTE → applyPromotion → tính kết quả.

import { GameError } from "../../utils/GameError.js";
import { ActionType } from "../constants/ActionType.js";
import { ErrorCode } from "../constants/ErrorCode.js";
import { applyMove, applyPromotion } from "./applyMove.js";
import {
  PROMOTE_RULES,
  RULES_BY_KIND,
  buildMoveInput,
  buildPromoteInput,
  classifyMove,
  evaluateOutcome,
  ruleSet,
} from "./moveFacts.js";

export function reduce(game, action) {
  switch (action.type) {
    case ActionType.MOVE:
      return reduceMove(game, action);
    case ActionType.PROMOTE:
      return reducePromote(game, action);
    default:
      throw new GameError(ErrorCode.BAD_ACTION, `Action không hỗ trợ: ${action.type}`);
  }
}

function findPiece(game, id) {
  const piece = game.board.pieceById(id);
  if (piece === null) throw new GameError(ErrorCode.INVALID_ID, `Không có quân ${id}`);
  return piece;
}

function reduceMove(game, action) {
  const { row, col } = action;
  const piece = findPiece(game, action.id);
  const kind = classifyMove(game, piece, row, col);
  const input = buildMoveInput(game, piece, row, col, kind);

  for (const key of RULES_BY_KIND[kind]) ruleSet.get(key).check(input);

  return settle(applyMove(game, piece, row, col, kind));
}

function reducePromote(game, action) {
  const piece = findPiece(game, action.id);
  const input = buildPromoteInput(game, piece, action);

  for (const key of PROMOTE_RULES) ruleSet.get(key).check(input);

  return settle(applyPromotion(game, action.pieceType));
}

// Tính kết quả ván cho bên sắp đi. Đang chờ phong cấp thì thế cờ chưa xong, chưa tính.
function settle(game) {
  if (game.pendingPromotion !== null) return game;
  const result = evaluateOutcome(game);
  return result === null ? game : game.withResult(result);
}