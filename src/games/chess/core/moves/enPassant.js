/**
 * @file enPassant.js
 * @author tuanca
 */
import { GameError } from "../../utils/GameError.js";
import { ErrorCode } from "../constants/ErrorCode.js";
import { MoveKind } from "../constants/MoveKind.js";
import { PieceType } from "../constants/PieceType.js";
import { SIDE_SIGN } from "../constants/Side.js";
import { inBoard, kingSafe } from "./checks.js";
import { finish } from "./finish.js";

/**
 * @typedef {import("./index.js").Game} Game
 * @typedef {import("./index.js").Piece} Piece
 * @typedef {import("./index.js").Move} Move
 * @typedef {import("./index.js").MoveContext} MoveContext
 * @typedef {import("./index.js").MatchesFn} MatchesFn
 * @typedef {import("./index.js").CandidatesFn} CandidatesFn
 * @typedef {import("./index.js").FactsFn} FactsFn
 */

/**
 * Kiểm tra quân bị bắt là tốt đối phương.
 * `matches` đã bảo đảm ô đích trùng `enPassantTarget` nên không cần check lại.
 *
 * @param {MoveContext} ctx - Ngữ cảnh của nước đi, cần `ctx.f.victim`.
 * @returns {GameError | null} `null` nếu qua, `GameError` nếu không có tốt đối phương để bắt.
 */
export const victimIsEnemyPawn = (ctx) => {
  const v = ctx.f.victim;
  return v !== null && v.type === PieceType.PAWN && v.side !== ctx.piece.side
    ? null
    : new GameError(
        ErrorCode.ILLEGAL_MOVE,
        "Không có tốt đối phương vừa đi hai ô để bắt",
      );
};

/**
 * Áp dụng nước bắt tốt qua đường: tốt bắt đi chéo vào ô trống, tốt đối phương
 * đứng cùng hàng với tốt bắt và cùng cột với ô đích bị loại khỏi bàn.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} pawn - Tốt thực hiện nước bắt.
 * @param {number} row - Hàng của ô đích (chính là `enPassantTarget`).
 * @param {number} col - Cột của ô đích.
 * @returns {Game} Game mới sau nước đi, `game` truyền vào không bị thay đổi.
 * @throws {GameError} Nếu quân đi không phải tốt hoặc không có tốt đối phương để bắt.
 */
export function applyEnPassant(game, pawn, row, col) {
  if (pawn.type !== PieceType.PAWN)
    throw new GameError(ErrorCode.BAD_ACTION, "Chỉ tốt mới bắt qua đường");

  const victim = game.board.pieceAt(pawn.row, col);
  if (
    victim === null ||
    victim.type !== PieceType.PAWN ||
    victim.side === pawn.side
  )
    throw new GameError(
      ErrorCode.BAD_ACTION,
      "Không có tốt đối phương để bắt qua đường",
    );

  const moved = pawn.with({ row, col, hasMoved: true });
  const board = game.board.remove(victim.id).remove(pawn.id).add(moved);
  return finish(game, board, pawn.side, null, null);
}

/**
 * Nước bắt tốt qua đường: tốt đi chéo vào `enPassantTarget` đang trống.
 *
 * @type {Move}
 */
export const enPassant = {
  kind: MoveKind.EN_PASSANT,

  /** @type {MatchesFn} Tốt đi chéo 1 ô vào đúng `enPassantTarget` đang trống. */
  matches: (game, piece, row, col) => {
    const ep = game.enPassantTarget;
    return (
      piece.type === PieceType.PAWN &&
      ep !== null &&
      row === ep.row &&
      col === ep.col &&
      row === piece.row - SIDE_SIGN[piece.side] &&
      Math.abs(col - piece.col) === 1 &&
      game.board.pieceAt(row, col) === null
    );
  },

  /** @type {CandidatesFn} Tốt chỉ có ứng viên khi đang có `enPassantTarget`. */
  candidates: (game, piece) => {
    const ep = game.enPassantTarget;
    return piece.type === PieceType.PAWN && ep !== null
      ? [{ row: ep.row, col: ep.col }]
      : [];
  },

  /** @type {FactsFn} Dữ kiện tính lười: victim (quân đứng cạnh tốt bắt). */
  facts: (game, pawn, row, col) => ({
    victim: () => game.board.pieceAt(pawn.row, col),
  }),

  // victimIsEnemyPawn phải đứng trước kingSafe vì apply ném lỗi nếu không có nạn nhân
  checks: [inBoard, victimIsEnemyPawn, kingSafe],
  apply: applyEnPassant,
};