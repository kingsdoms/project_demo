/**
 * @file castle.js
 * @author tuanca
 */

import { GameError } from "../../utils/GameError.js";
import { ErrorCode } from "../constants/ErrorCode.js";
import { MoveKind } from "../constants/MoveKind.js";
import { PieceType } from "../constants/PieceType.js";
import { OPPONENT } from "../constants/Side.js";
import { isAttacked } from "./squares.js";
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
 * Kiểm tra vua chưa từng di chuyển.
 *
 * @param {MoveContext} ctx - Ngữ cảnh của nước đi.
 * @returns {GameError | null} `null` nếu qua, `GameError` nếu vua đã đi.
 */
export const kingNotMoved = (ctx) =>
  ctx.piece.hasMoved
    ? new GameError(
        ErrorCode.CASTLE_ILLEGAL,
        "Vua đã đi nên không nhập thành được",
      )
    : null;

/**
 * Kiểm tra có xe cùng phe ở góc và xe chưa từng di chuyển.
 *
 * @param {MoveContext} ctx - Ngữ cảnh của nước đi, cần `ctx.f.rook`.
 * @returns {GameError | null} `null` nếu qua, `GameError` nếu xe không còn ở góc hoặc đã đi.
 */
export const rookReady = (ctx) => {
  const rook = ctx.f.rook;
  return rook !== null && !rook.hasMoved
    ? null
    : new GameError(ErrorCode.CASTLE_ILLEGAL, "Xe không còn ở góc hoặc đã đi");
};

/**
 * Kiểm tra các ô giữa vua và xe đều trống.
 *
 * @param {MoveContext} ctx - Ngữ cảnh của nước đi, cần `ctx.f.pathEmpty`.
 * @returns {GameError | null} `null` nếu qua, `GameError` nếu còn quân chắn giữa.
 */
export const pathEmpty = (ctx) =>
  ctx.f.pathEmpty
    ? null
    : new GameError(ErrorCode.CASTLE_ILLEGAL, "Giữa vua và xe còn quân");

/**
 * Kiểm tra vua không đang bị chiếu.
 *
 * @param {MoveContext} ctx - Ngữ cảnh của nước đi, cần `ctx.f.inCheck`.
 * @returns {GameError | null} `null` nếu qua, `GameError` nếu vua đang bị chiếu.
 */
export const notInCheck = (ctx) =>
  ctx.f.inCheck
    ? new GameError(
        ErrorCode.CASTLE_ILLEGAL,
        "Không nhập thành khi đang bị chiếu",
      )
    : null;

/**
 * Kiểm tra vua không đi qua hoặc đáp xuống ô bị tấn công.
 *
 * @param {MoveContext} ctx - Ngữ cảnh của nước đi, cần `ctx.f.passesAttacked`.
 * @returns {GameError | null} `null` nếu qua, `GameError` nếu một trong hai ô bị tấn công.
 */
export const passesNotAttacked = (ctx) =>
  ctx.f.passesAttacked
    ? new GameError(
        ErrorCode.CASTLE_ILLEGAL,
        "Vua không được đi qua hoặc tới ô bị chiếu",
      )
    : null;

/**
 * Áp dụng nước nhập thành: vua đi 2 ô, xe nhảy sang ô vua vừa đi qua.
 * Nhập thành gần: vua cột 4 → 6, xe cột 7 → 5.
 * Nhập thành xa: vua cột 4 → 2, xe cột 0 → 3.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} king - Quân vua nhập thành.
 * @param {number} row - Hàng của ô đích, phải bằng hàng của vua.
 * @param {number} col - Cột của ô đích, cách vua đúng 2 cột.
 * @returns {Game} Game mới sau nước đi, `game` truyền vào không bị thay đổi.
 * @throws {GameError} Nếu quân đi không phải vua, đích không đúng 2 ô ngang,
 *   hoặc không có xe ở góc.
 */
export function applyCastle(game, king, row, col) {
  if (king.type !== PieceType.KING)
    throw new GameError(ErrorCode.BAD_ACTION, "Chỉ vua mới nhập thành");
  if (row !== king.row || Math.abs(col - king.col) !== 2)
    throw new GameError(
      ErrorCode.BAD_ACTION,
      "Nhập thành: vua phải đi đúng 2 ô theo hàng ngang",
    );

  const board = game.board;
  const dir = Math.sign(col - king.col);
  const rookCol = dir > 0 ? board.cols - 1 : 0;

  const rook = board.pieceAt(king.row, rookCol);
  if (rook === null || rook.type !== PieceType.ROOK || rook.side !== king.side)
    throw new GameError(ErrorCode.BAD_ACTION, "Không có xe để nhập thành");

  const kingMoved = king.with({ col, hasMoved: true });
  const rookMoved = rook.with({ col: king.col + dir, hasMoved: true });

  const next = board
    .remove(king.id)
    .remove(rook.id)
    .add(kingMoved)
    .add(rookMoved);

  return finish(game, next, king.side, null, null);
}

/**
 * Nước nhập thành: vua đi ngang đúng 2 ô.
 *
 * @type {Move}
 */
export const castle = {
  kind: MoveKind.CASTLE,

  /** @type {MatchesFn} Vua đi ngang đúng 2 ô. */
  matches: (game, piece, row, col) =>
    piece.type === PieceType.KING &&
    row === piece.row &&
    Math.abs(col - piece.col) === 2,

  /** @type {CandidatesFn} Vua đi ngang sang trái hoặc phải 2 ô. */
  candidates: (game, piece) =>
    piece.type === PieceType.KING
      ? [
          { row: piece.row, col: piece.col - 2 },
          { row: piece.row, col: piece.col + 2 },
        ]
      : [],

  /** @type {FactsFn} Dữ kiện tính lười: rook, pathEmpty, inCheck, passesAttacked. */
  facts: (game, king, row, col) => {
    const board = game.board;
    const dir = Math.sign(col - king.col);
    const rookCol = dir > 0 ? board.cols - 1 : 0;
    const enemy = OPPONENT[king.side];
    return {
      rook: () => {
        const p = board.pieceAt(king.row, rookCol);
        return p !== null && p.type === PieceType.ROOK && p.side === king.side
          ? p
          : null;
      },
      pathEmpty: () => {
        const lo = Math.min(king.col, rookCol);
        const hi = Math.max(king.col, rookCol);
        for (let c = lo + 1; c < hi; c++) {
          if (board.pieceAt(king.row, c) !== null) return false;
        }
        return true;
      },
      inCheck: () => isAttacked(board, king.row, king.col, enemy),
      // Ô vua đi qua và ô vua tới
      passesAttacked: () =>
        [1, 2].some((i) =>
          isAttacked(board, king.row, king.col + dir * i, enemy),
        ),
    };
  },

  // rookReady phải đứng trước kingSafe vì applyCastle ném lỗi nếu không có xe
  checks: [
    inBoard,
    kingNotMoved,
    rookReady,
    pathEmpty,
    notInCheck,
    passesNotAttacked,
    kingSafe,
  ],
  apply: applyCastle,
};