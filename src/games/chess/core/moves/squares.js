/**
 * @file squares.js
 * @author tuanca
 */
import { GameError } from "../../utils/GameError.js";
import { ErrorCode } from "../constants/ErrorCode.js";
import { CaptureMode } from "../constants/CaptureMode.js";
import { PieceType } from "../constants/PieceType.js";
import { SIDE_SIGN } from "../constants/Side.js";
import { PIECE_MOVE_DEFS } from "../constants/PieceMoveDefs.js";

/**
 * @typedef {import("./index.js").Piece} Piece
 * @typedef {import("./index.js").Board} Board
 * @typedef {import("../constants/Side.js").SideValue} SideValue
 */

/** @type {{ unmoved: (piece: Piece) => boolean }} */
const REQUIRES = { unmoved: (piece) => !piece.hasMoved };

/**
 * Tính danh sách các ô liên quan đến hướng di chuyển của một quân cờ.
 *
 * Phân biệt hai chế độ:
 * - `forAttack = true`: trả về các ô quân cờ kiểm soát. Với tốt, chỉ tính
 *   hai ô chéo phía trước, kể cả khi các ô đó đang trống.
 * - `forAttack = false`: trả về các ô quân cờ có thể đi tới theo hình học
 *   và luật di chuyển của quân, kể cả ô đang có quân cùng bên. Việc loại
 *   mục tiêu đồng minh được xử lý riêng bởi check `targetNotAlly` của nước đi thường.
 *
 * Hàm chỉ xác định các ô ứng viên theo kiểu quân và trạng thái bàn cờ;
 * không tự quyết định toàn bộ tính hợp lệ của nước đi.
 *
 * @param {Board} board - Bàn cờ hiện tại.
 * @param {Piece} piece - Quân cờ cần xác định các ô đi tới hoặc kiểm soát.
 * @param {boolean} forAttack - `true` để lấy ô kiểm soát, `false` để lấy ô đi tới.
 * @returns {{ row: number, col: number }[]} Danh sách tọa độ các ô tương ứng.
 */
function patternSquares(board, piece, forAttack) {
  const s = SIDE_SIGN[piece.side];
  /** @type {{ row: number, col: number }[]} */
  const squares = [];

  for (const m of PIECE_MOVE_DEFS[piece.type]) {
    // Attack but capture is never
    if (forAttack && m.capture === CaptureMode.NEVER) continue;
    // When contain requires
    if (m.requires !== undefined) {
      const met = REQUIRES[/** @type {keyof typeof REQUIRES} */ (m.requires)];
      if (met === undefined)
        throw new GameError(
          ErrorCode.INVALID_ARGUMENT,
          `Điều kiện "${m.requires}" chưa được khai báo`,
        );
      if (!met(piece)) continue;
    }

    const ray = board.ray(
      piece.row,
      piece.col,
      -s * m.forward,
      s * m.lateral,
      m.steps,
    );
    // ray dừng ngay sau ô có quân đầu tiên, nên ray.length === steps nghĩa là các ô giữa đều trống
    const reached =
      m.steps === Infinity
        ? ray
        : ray.length === m.steps
          ? [ray[ray.length - 1]]
          : [];

    for (const sq of reached) {
      const occupied = sq.piece !== null;
      const ok =
        forAttack ||
        m.capture === CaptureMode.ANY ||
        (m.capture === CaptureMode.NEVER && !occupied) ||
        (m.capture === CaptureMode.ONLY && occupied);
      if (ok) squares.push(sq);
    }
  }
  return squares;
}

/**
 * Lấy các ô mà quân cờ có thể di chuyển tới theo quy tắc hình học.
 *
 * @param {Board} board - Bàn cờ hiện tại.
 * @param {Piece} piece - Quân cờ cần kiểm tra.
 * @returns {{ row: number, col: number }[]} Danh sách tọa độ các ô có thể đi tới.
 */
export const movementSquares = (board, piece) =>
  patternSquares(board, piece, false);

/**
 * Lấy các ô mà quân cờ đang kiểm soát hoặc tấn công.
 *
 * Với quân tốt, các ô chéo phía trước vẫn được tính kể cả khi đang trống.
 *
 * @param {Board} board - Bàn cờ hiện tại.
 * @param {Piece} piece - Quân cờ cần kiểm tra.
 * @returns {{ row: number, col: number }[]} Danh sách tọa độ các ô bị kiểm soát.
 */
export const attackSquares = (board, piece) =>
  patternSquares(board, piece, true);

/**
 * Kiểm tra danh sách tọa độ có chứa ô được chỉ định hay không.
 *
 * @param {{ row: number, col: number }[]} squares - Danh sách tọa độ các ô.
 * @param {number} row - Hàng cần kiểm tra.
 * @param {number} col - Cột cần kiểm tra.
 * @returns {boolean} `true` nếu tìm thấy ô tương ứng, ngược lại là `false`.
 */
export const hasSquare = (squares, row, col) =>
  squares.some((sq) => sq.row === row && sq.col === col);

/**
 * Kiểm tra ô tại vị trí (row, col) có bị ít nhất một quân cờ
 * thuộc phe tấn công kiểm soát hay không.
 *
 * Duyệt các quân cờ trên bàn và sử dụng isAttacker để lọc những quân
 * thuộc phe cần kiểm tra. Với mỗi quân phù hợp, kiểm tra xem ô mục tiêu
 * có nằm trong tập ô mà quân đó tấn công hay không.
 *
 * @param {Board} board - Trạng thái bàn cờ hiện tại.
 * @param {number} row - Hàng của ô cần kiểm tra.
 * @param {number} col - Cột của ô cần kiểm tra.
 * @param {(piece: Piece) => boolean} isAttacker - Hàm xác định quân cờ
 *        có thuộc phe tấn công cần kiểm tra hay không.
 * @returns {boolean} true nếu có ít nhất một quân thuộc phe đó tấn công
 *                    ô mục tiêu; ngược lại trả về false.
 */
function attackedBy(board, row, col, isAttacker) {
  return board.pieces.some(
    (p) => isAttacker(p) && hasSquare(attackSquares(board, p), row, col),
  );
}

/**
 * Kiểm tra một ô có bị ít nhất một quân của bên chỉ định tấn công hay không.
 *
 * Dựa trên danh sách ô tấn công của từng quân, không phụ thuộc vào việc
 * ô đích hiện có quân hay đang trống.
 *
 * @param {Board} board - Bàn cờ hiện tại.
 * @param {number} row - Hàng của ô cần kiểm tra.
 * @param {number} col - Cột của ô cần kiểm tra.
 * @param {SideValue} bySide - Bên có quân đang xét tấn công.
 * @returns {boolean} `true` nếu ô bị tấn công, ngược lại là `false`.
 */
export function isAttacked(board, row, col, bySide) {
  return attackedBy(board, row, col, (p) => p.side === bySide);
}

/**
 * Tìm quân vua của một bên trên bàn cờ.
 *
 * @param {Board} board - Bàn cờ cần tìm.
 * @param {SideValue} side - Bên sở hữu quân vua.
 * @returns {Piece | null} Quân vua nếu tìm thấy, hoặc `null` nếu không có.
 */
export function findKing(board, side) {
  return (
    board.pieces.find((p) => p.type === PieceType.KING && p.side === side) ??
    null
  );
}

/**
 * Kiểm tra vua của phe `side` có đang bị chiếu hay không.
 *
 * Tìm vị trí vua của phe được chỉ định, sau đó kiểm tra xem ô vua
 * đang đứng có bị quân thuộc phe đối phương tấn công hay không.
 *
 * Nếu bàn cờ không có vua của phe đó (ví dụ: bàn cờ dùng để thử nghiệm),
 * xem như phe đó không bị chiếu.
 *
 * @param {Board} board - Trạng thái bàn cờ hiện tại.
 * @param {SideValue} side - Phe cần kiểm tra trạng thái chiếu.
 * @returns {boolean} true nếu vua của phe đó đang bị chiếu;
 *                    false nếu không bị chiếu hoặc không tìm thấy vua.
 */
export function isInCheck(board, side) {
  const king = findKing(board, side);
  return (
    king !== null &&
    attackedBy(board, king.row, king.col, (p) => p.side !== side)
  );
}