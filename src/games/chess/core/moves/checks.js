/**
 * @file checks.js
 * @author tuanca
 */
import { GameError } from "../../utils/GameError.js";
import { ErrorCode } from "../constants/ErrorCode.js";
import { isInCheck } from "./squares.js";

/**
 * @typedef {import("./index.js").CheckContext} CheckContext
 * @typedef {import("./index.js").MoveContext} MoveContext
 */

/**
 * Kiểm tra ô đích (ctx.row, ctx.col) có nằm trong bàn cờ không.
 *
 * @param {MoveContext} ctx - Ngữ cảnh của nước đi.
 * @returns {GameError | null} `null` nếu qua, `GameError` nếu ô đích nằm ngoài bàn.
 */
export const inBoard = (ctx) =>
  ctx.game.board.inBounds(ctx.row, ctx.col)
    ? null
    : new GameError(ErrorCode.ILLEGAL_MOVE, "Ô đích nằm ngoài bàn");

/**
 * Kiểm tra vua của bên đi có an toàn sau nước đi này không.
 * Đây là check tốn kém nhất: giả lập nước đi bằng chính `apply` của move đang
 * chạy (trả về game mới, `ctx.game` không bị đổi), rồi kiểm tra trên bàn cờ
 * sau khi đi. Phải đặt cuối mảng `checks` để các check rẻ hơn loại nước sai
 * trước, vì `apply` có thể ném lỗi nếu nước đi chưa hợp lệ.
 *
 * @param {MoveContext} ctx - Ngữ cảnh của nước đi.
 * @returns {GameError | null} `null` nếu qua, `GameError` nếu vua bị chiếu sau nước đi.
 */
export const kingSafe = (ctx) => {
  const after = ctx.move.apply(ctx.game, ctx.piece, ctx.row, ctx.col);
  return isInCheck(after.board, ctx.piece.side)
    ? new GameError(ErrorCode.SELF_CHECK, "Nước đi này để vua bị chiếu")
    : null;
};

/**
 * Kiểm tra ván cờ chưa kết thúc.
 *
 * @param {CheckContext} ctx - Ngữ cảnh kiểm tra.
 * @returns {GameError | null} `null` nếu qua, `GameError` nếu ván đã có kết quả.
 */
export const gameNotOver = (ctx) =>
  ctx.game.result === null
    ? null
    : new GameError(ErrorCode.GAME_OVER, "Ván đã kết thúc");

/**
 * Kiểm tra không có tốt nào đang chờ phong cấp.
 *
 * @param {CheckContext} ctx - Ngữ cảnh kiểm tra.
 * @returns {GameError | null} `null` nếu qua, `GameError` nếu còn phải phong cấp.
 */
export const noPromotionPending = (ctx) =>
  ctx.game.pendingPromotion === null
    ? null
    : new GameError(ErrorCode.PROMOTION_PENDING, "Phải phong cấp quân trước");

/**
 * Kiểm tra quân được chọn thuộc bên đang tới lượt.
 *
 * @param {CheckContext} ctx - Ngữ cảnh kiểm tra.
 * @returns {GameError | null} `null` nếu qua, `GameError` nếu chưa tới lượt bên đó.
 */
export const yourTurn = (ctx) =>
  ctx.piece.side === ctx.game.turn
    ? null
    : new GameError(ErrorCode.NOT_YOUR_TURN, "Không phải lượt của bạn");

/**
 * Các check áp dụng cho mọi nước đi, chạy trước check riêng của từng loại.
 *
 * @type {((ctx: CheckContext) => GameError | null)[]}
 */
export const COMMON_CHECKS = [gameNotOver, noPromotionPending, yourTurn];