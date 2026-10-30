/**
 * @file validate.js
 * @author tuanca
 */
import { lazy } from "../../utils/lazy.js";
import { COMMON_CHECKS } from "./checks.js";

/**
 * @typedef {import("../../utils/GameError.js").GameError} GameError
 * @typedef {import("./index.js").Game} Game
 * @typedef {import("./index.js").Piece} Piece
 * @typedef {import("./index.js").Move} Move
 * @typedef {import("./index.js").MoveContext} MoveContext
 */

/**
 * Chạy tuần tự danh sách các check và trả về lỗi đầu tiên nếu có.
 *
 * @template C
 * @param {((ctx: C) => GameError | null)[]} checks - Danh sách các hàm check.
 * @param {C} ctx - Ngữ cảnh truyền cho từng check.
 * @returns {GameError | null} Lỗi của check đầu tiên thất bại, hoặc `null` nếu qua hết.
 */
export function runChecks(checks, ctx) {
  for (const check of checks) {
    const error = check(ctx);
    if (error) return error;
  }
  return null;
}

/**
 * Xác thực nước đi theo các quy tắc chung của game và quy tắc riêng
 * của từng loại nước đi.
 *
 * Các quy tắc chung được kiểm tra trước, sau đó mới kiểm tra các điều kiện
 * đặc thù của nước đi. Đây là đường kiểm tra duy nhất: `reduce` dùng nó để
 * chấp nhận action, `legalMoves` dùng nó để liệt kê nước đi hợp lệ.
 *
 * @param {Move} move - Loại nước đi cần xác thực.
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ thực hiện nước đi.
 * @param {number} row - Hàng đích.
 * @param {number} col - Cột đích.
 * @returns {GameError | null} Lỗi đầu tiên gặp phải, hoặc `null` nếu nước đi hợp lệ.
 */
export function validate(move, game, piece, row, col) {
  /** @type {MoveContext} */
  const ctx = {
    move,
    game,
    piece,
    row,
    col,
    // Dữ kiện tính lười: chỉ tính khi check đọc tới và nhớ kết quả
    f: lazy(move.facts?.(game, piece, row, col) ?? {}),
  };
  return runChecks(COMMON_CHECKS, ctx) ?? runChecks(move.checks, ctx);
}