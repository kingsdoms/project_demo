/**
 * @file normal.js
 * @author tuanca
 */
import { GameError } from "../../utils/GameError.js";
import { ErrorCode } from "../constants/ErrorCode.js";
import { MoveKind } from "../constants/MoveKind.js";
import { PieceType } from "../constants/PieceType.js";
import { PROMOTION_RANK } from "../constants/StandardDef.js";
import { hasSquare, movementSquares } from "./squares.js";
import { inBoard, kingSafe } from "./checks.js";
import { finish } from "./finish.js";
import { Square } from "../models/Square.js";

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
 * Kiểm tra quân có đi tới được ô đích theo quy tắc hình học của nó không.
 *
 * @param {MoveContext} ctx - Ngữ cảnh của nước đi, cần `ctx.f.reachable`.
 * @returns {GameError | null} `null` nếu qua, `GameError` nếu quân không đi tới được ô đó.
 */
export const reachable = (ctx) =>
  ctx.f.reachable
    ? null
    : new GameError(ErrorCode.ILLEGAL_MOVE, "Quân này không đi tới được ô đó");

/**
 * Kiểm tra ô đích không có quân cùng phe.
 *
 * @param {MoveContext} ctx - Ngữ cảnh của nước đi, cần `ctx.f.targetIsAlly`.
 * @returns {GameError | null} `null` nếu qua, `GameError` nếu ô đích có quân cùng phe.
 */
export const targetNotAlly = (ctx) =>
  ctx.f.targetIsAlly
    ? new GameError(ErrorCode.ILLEGAL_MOVE, "Ô đích có quân cùng phe")
    : null;

/**
 * Áp dụng nước đi thông thường (di chuyển hoặc ăn quân).
 * Tốt đi 2 ô để lại `enPassantTarget`, tốt tới hàng cuối thì chờ phong cấp.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ di chuyển.
 * @param {number} row - Hàng của ô đích.
 * @param {number} col - Cột của ô đích.
 * @returns {Game} Game mới sau nước đi, `game` truyền vào không bị thay đổi.
 */
export function applyNormal(game, piece, row, col) {
  let board = game.board;

  // Ăn quân: bỏ quân ở ô đích trước khi đặt quân mới vào
  const target = board.pieceAt(row, col);
  if (target !== null) board = board.remove(target.id);

  const moved = piece.with({ row, col, hasMoved: true });
  board = board.remove(piece.id).add(moved);

  const isPawn = piece.type === PieceType.PAWN;
  const doubleStep = isPawn && Math.abs(row - piece.row) === 2;
  const promotes = isPawn && row === PROMOTION_RANK[piece.side];

  return finish(
    game,
    board,
    piece.side,
    // Ô bị bỏ qua nằm giữa ô xuất phát và ô đích
    doubleStep ? new Square({ row: (piece.row + row) / 2, col }) : null,
    promotes ? moved.id : null,
  );
}

/**
 * Nước đi thông thường, cũng là trường hợp mặc định: `matches` luôn `true`
 * nên phải đứng cuối danh sách move.
 *
 * @type {Move}
 */
export const normal = {
  kind: MoveKind.NORMAL,

  /** @type {MatchesFn} Luôn `true`. */
  matches: () => true,

  /** @type {CandidatesFn} Các ô quân đi tới được theo quy tắc hình học. */
  candidates: (game, piece) => movementSquares(game.board, piece),

  /** @type {FactsFn} Dữ kiện tính lười: reachable, targetIsAlly. */
  facts: (game, piece, row, col) => ({
    reachable: () => hasSquare(movementSquares(game.board, piece), row, col),
    targetIsAlly: () => game.board.pieceAt(row, col)?.side === piece.side,
  }),

  checks: [inBoard, reachable, targetNotAlly, kingSafe], // rẻ → đắt
  apply: applyNormal,
};