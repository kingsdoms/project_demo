/**
 * @file moveInput.js
 * @author tuanca
 */

// Phân loại một nước đi (thường, nhập thành, bắt qua đường) và dựng input cho rule:
// các "sự thật" như move.inBoard, castle.pathEmpty, passant.targetMatches.
// Chỉ đọc, không đổi state. Mọi sự thật đều tính lười (xem utils/lazy.js).
import { lazy } from "../../utils/lazy.js";
import { SIDE_SIGN, OPPONENT } from "../constants/Side.js";
import { PieceType } from "../constants/PieceType.js";
import { MoveKind } from "../constants/MoveKind.js";
import {
  hasSquare,
  isAttacked,
  isInCheck,
  movementSquares,
} from "./squares.js";
import { applyMove } from "./applyAction.js";

/**
 * @typedef {import("../models/Piece.js").Piece} Piece
 * @typedef {import("../models/Board.js").Board} Board
 * @typedef {import("../models/Game.js").Game} Game
 * @typedef {import("../models/Action.js").Action} Action
 *
 */

/**
 * Phân loại nước đi dựa trên hình dạng và trạng thái hiện tại của game,
 * chưa kiểm tra nước đi có hợp lệ theo luật hay không.
 * Vua di chuyển ngang 2 ô được phân loại là nhập thành.
 * Tốt di chuyển chéo vào ô `enPassantTarget` đang trống được phân loại
 * là bắt tốt qua đường.
 *
 * @param {Game} game - Trạng thái game hiện tại.
 * @param {Piece} piece - Quân cờ thực hiện nước đi.
 * @param {number} row - Hàng đích.
 * @param {number} col - Cột đích.
 * @returns {typeof MoveKind[keyof typeof MoveKind]} Loại nước đi được phân loại.
 */
export function classifyMove(game, piece, row, col) {
  if (
    piece.type === PieceType.KING &&
    row === piece.row &&
    Math.abs(col - piece.col) === 2
  )
    return MoveKind.CASTLE;

  const ep = game.enPassantTarget;
  if (
    piece.type === PieceType.PAWN &&
    ep !== null &&
    row === ep.row &&
    col === ep.col &&
    row === piece.row - SIDE_SIGN[piece.side] &&
    Math.abs(col - piece.col) === 1 &&
    game.board.pieceAt(row, col) === null
  )
    return MoveKind.EN_PASSANT;

  return MoveKind.NORMAL;
}

/**
 * Tính các điều kiện cần thiết để xác định nước nhập thành có hợp lệ hay không.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} king - Quân vua thực hiện nhập thành.
 * @param {number} col - Cột đích mà vua muốn di chuyển tới.
 * @returns {object} Các thông tin phục vụ việc kiểm tra điều kiện nhập thành.
 */
function castleFacts(game, king, col) {
  const board = game.board;
  const dir = Math.sign(col - king.col);
  const rookCol = dir > 0 ? board.cols - 1 : 0;
  const found = board.pieceAt(king.row, rookCol);
  const rook =
    found !== null && found.type === PieceType.ROOK && found.side === king.side
      ? found
      : null;
  const enemy = OPPONENT[king.side];

  return {
    // Không có xe ở góc thì coi như xe đã đi, nhập thành bị từ chối
    rook: rook ?? { hasMoved: true },
    castle: lazy({
      pathEmpty: () => {
        const lo = Math.min(king.col, rookCol);
        const hi = Math.max(king.col, rookCol);
        for (let c = lo + 1; c < hi; c++) {
          if (board.pieceAt(king.row, c) !== null) return false;
        }
        return rook !== null;
      },
      inCheck: () => isAttacked(board, king.row, king.col, enemy),
      // Ô vua đi qua và ô vua tới
      passesAttacked: () =>
        [1, 2].some((i) =>
          isAttacked(board, king.row, king.col + dir * i, enemy),
        ),
    }),
  };
}

/**
 * Tính các thông tin cần thiết để kiểm tra nước bắt tốt qua đường (en passant).
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} pawn - Quân tốt đang thực hiện nước bắt qua đường.
 * @param {number} row - Hàng đích của nước đi.
 * @param {number} col - Cột đích của nước đi.
 * @returns {object} Các thông tin phục vụ việc kiểm tra điều kiện bắt tốt qua đường.
 */
function passantFacts(game, pawn, row, col) {
  const ep = game.enPassantTarget;
  return {
    passant: lazy({
      targetMatches: () => ep !== null && ep.row === row && ep.col === col,
      // enPassantTarget chỉ tồn tại ngay sau một nước đi 2 ô, nên tốt đối phương đứng cạnh là tốt vừa đi
      capturedPawnJustDoubled: () => {
        const victim = game.board.pieceAt(pawn.row, col);
        return (
          ep !== null &&
          victim !== null &&
          victim.type === PieceType.PAWN &&
          victim.side !== pawn.side &&
          victim.col === ep.col
        );
      },
    }),
  };
}

/**
 * Xây dựng dữ liệu đầu vào cho các rule kiểm tra một nước đi.
 *
 * Tạo object chứa trạng thái ván cờ, quân cờ, tọa độ đích, loại nước đi
 * và các sự thật cần thiết để đánh giá tính hợp lệ của nước đi.
 * Các sự thật được tính lười (lazy evaluation): chỉ tính khi rule truy cập
 * và lưu kết quả để tái sử dụng, tránh lặp lại các phép tính tốn kém.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ thực hiện nước đi.
 * @param {number} row - Hàng đích.
 * @param {number} col - Cột đích.
 * @param {typeof MoveKind[keyof typeof MoveKind]} kind - Loại nước đi.
 * @returns {Record<string, unknown>} Dữ liệu đầu vào cho các rule.
 */
export function buildMoveInput(game, piece, row, col, kind) {
  const board = game.board;
  const input = {
    piece,
    turn: game.turn,
    state: { result: game.result },
    move: lazy({
      inBoard: () => board.inBounds(row, col),
      reachable: () =>
        board.inBounds(row, col) &&
        hasSquare(movementSquares(board, piece), row, col),
      targetIsAlly: () => board.pieceAt(row, col)?.side === piece.side,
      // Thử đi nước đó trên bàn mới rồi xem vua mình có bị tấn công không
      exposesKing: () =>
        isInCheck(applyMove(game, piece, row, col, kind).board, piece.side),
      blockedByPromotion: () => game.pendingPromotion !== null,
    }),
  };
  if (kind === MoveKind.CASTLE)
    Object.assign(input, castleFacts(game, piece, col));
  if (kind === MoveKind.EN_PASSANT)
    Object.assign(input, passantFacts(game, piece, row, col));
  return input;
}

/**
 * Xây dựng dữ liệu đầu vào cho rule kiểm tra phong cấp quân.
 *
 * Kết hợp trạng thái ván cờ, quân tốt cần phong cấp và hành động được yêu cầu
 * để rule `PROMOTE` xác định hành động phong cấp có hợp lệ hay không.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ thực hiện nước đi.
 * @param {Action} action - Hành động yêu cầu phong cấp.
 * @returns {Record<string, unknown>} Dữ liệu đầu vào cho rule `PROMOTE`.
 */
export function buildPromoteInput(game, piece, action) {
  return {
    turn: game.turn,
    state: { result: game.result },
    pendingPromotion: game.pendingPromotion,
    piece,
    pieceType:piece.type,
    newPieceType: action.pieceType,
  };
}
