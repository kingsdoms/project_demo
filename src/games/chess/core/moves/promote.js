/**
 * @file promote.js
 * @author tuanca
 */

import { GameError } from "../../utils/GameError.js";
import { ErrorCode } from "../constants/ErrorCode.js";
import { PieceType } from "../constants/PieceType.js";
import { OPPONENT } from "../constants/Side.js";
import { PROMOTION_RANK, PROMOTION_TARGETS } from "../constants/StandardDef.js";
import { gameNotOver, yourTurn } from "./checks.js";
import { runChecks } from "./validate.js";

/**
 * @typedef {import("./index.js").Game} Game
 * @typedef {import("./index.js").Piece} Piece
 * @typedef {import("./index.js").PieceTypeValue} PieceTypeValue
 * @typedef {import("./index.js").PromotionContext} PromotionContext
 */

/**
 * Kiểm tra quân được chọn đúng là tốt đang chờ phong cấp.
 *
 * @param {PromotionContext} ctx - Ngữ cảnh phong cấp.
 * @returns {GameError | null} `null` nếu qua, `GameError` nếu quân này không chờ phong cấp.
 */
const isPendingPawn = (ctx) =>
  ctx.game.pendingPromotion === ctx.piece.id
    ? null
    : new GameError(ErrorCode.BAD_ACTION, "Quân này không đang chờ phong cấp");

/**
 * Kiểm tra quân được chọn là tốt.
 *
 * @param {PromotionContext} ctx - Ngữ cảnh phong cấp.
 * @returns {GameError | null} `null` nếu qua, `GameError` nếu không phải tốt.
 */
const isPawn = (ctx) =>
  ctx.piece.type === PieceType.PAWN
    ? null
    : new GameError(ErrorCode.BAD_ACTION, "Chỉ tốt được phong cấp");

/**
 * Kiểm tra tốt đã tới hàng cuối của bên mình.
 *
 * @param {PromotionContext} ctx - Ngữ cảnh phong cấp.
 * @returns {GameError | null} `null` nếu qua, `GameError` nếu tốt chưa tới hàng cuối.
 */
const onLastRank = (ctx) =>
  ctx.piece.row === PROMOTION_RANK[ctx.piece.side]
    ? null
    : new GameError(ErrorCode.BAD_ACTION, "Tốt chưa tới hàng cuối");

/**
 * Kiểm tra loại quân được chọn nằm trong danh sách được phép phong cấp.
 *
 * @param {PromotionContext} ctx - Ngữ cảnh phong cấp, cần `ctx.f.newType`.
 * @returns {GameError | null} `null` nếu qua, `GameError` nếu loại quân không được phép.
 */
const targetAllowed = (ctx) =>
  PROMOTION_TARGETS.includes(ctx.f.newType)
    ? null
    : new GameError(ErrorCode.BAD_ACTION, "Không được phong thành quân này");

const PROMOTE_CHECKS = [
  gameNotOver,
  yourTurn,
  isPendingPawn,
  isPawn,
  onLastRank,
  targetAllowed,
];

/**
 * Xác thực hành động phong cấp: ván chưa kết thúc, đúng lượt, đúng tốt đang
 * chờ ở hàng cuối và loại quân mới được phép.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Tốt được chọn để phong cấp.
 * @param {PieceTypeValue} newType - Loại quân muốn phong thành.
 * @returns {GameError | null} Lỗi đầu tiên gặp phải, hoặc `null` nếu hợp lệ.
 */
export const validatePromotion = (game, piece, newType) =>
  runChecks(PROMOTE_CHECKS, { game, piece, f: { newType } });

/**
 * Hoàn tất phong cấp cho tốt đang chờ trong `game.pendingPromotion` và đổi lượt.
 * Không kiểm tra tính hợp lệ, việc đó do `validatePromotion` đảm nhiệm.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Tốt được phong cấp.
 * @param {PieceTypeValue} pieceType - Loại quân mới.
 * @returns {Game} Game mới sau khi phong cấp, `game` truyền vào không bị thay đổi.
 */
export function applyPromotion(game, piece, pieceType) {
  const promoted = piece.with({ type: pieceType });
  const board = game.board.remove(piece.id).add(promoted);
  return game.with({
    board,
    pendingPromotion: null,
    turn: OPPONENT[piece.side],
  });
}