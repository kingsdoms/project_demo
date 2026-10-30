/**
 * @file PieceMoveDefs.js
 * @author tuanca
 */

import { PieceType } from "./PieceType.js";
import { CaptureMode } from "./CaptureMode.js";

/**
 * Một pattern di chuyển của quân cờ, viết từ góc nhìn bên trắng:
 * `forward` dương là tiến về phía đối phương. `ChessRule` sẽ đảo cả
 * `forward` lẫn `lateral` khi đọc cho bên đen.
 *
 * @typedef {Object} MovePattern
 * @property {number} forward
 *   Số ô tiến theo mỗi bước. Dương là tiến về phía đối phương, âm là lùi
 *   (ví dụ mã có `forward: -2`).
 * @property {number} lateral
 *   Số ô sang ngang theo mỗi bước. Hai dấu tương ứng hai phía trái/phải.
 * @property {number} steps
 *   Số lần lặp vector (forward, lateral) trong pattern:
 *   - `1`: đi đúng 1 ô.
 *   - `2`: đi 2 ô theo hướng đó.
 *   - `Infinity`: đi tiếp cho đến khi gặp quân hoặc hết bàn (xe, tượng, hậu).
 *   Khi `steps > 1`, mọi ô ở giữa phải trống. Ví dụ tốt đi 2 ô mà ô ngay
 *   phía trước có quân thì nước đó bị chặn. Mã chỉ có `steps = 1` nên không
 *   có ô giữa để kiểm tra.
 * @property {import("./CaptureMode.js").CaptureModeValue} capture
 *   Cách xử lý ô đích tuỳ theo ô trống hay có quân (xem `CaptureMode`).
 * @property {string} [requires]
 *   (Tuỳ chọn) Điều kiện thêm để pattern áp dụng. Hiện chỉ có `"unmoved"`:
 *   quân chưa từng di chuyển (tốt đi 2 ô ở nước đầu).
 */

const ROOK_MOVES = Object.freeze([
  Object.freeze({
    forward: 1,
    lateral: 0,
    steps: Infinity,
    capture: CaptureMode.ANY,
  }),
  Object.freeze({
    forward: -1,
    lateral: 0,
    steps: Infinity,
    capture: CaptureMode.ANY,
  }),
  Object.freeze({
    forward: 0,
    lateral: 1,
    steps: Infinity,
    capture: CaptureMode.ANY,
  }),
  Object.freeze({
    forward: 0,
    lateral: -1,
    steps: Infinity,
    capture: CaptureMode.ANY,
  }),
]);

const BISHOP_MOVES = Object.freeze([
  Object.freeze({
    forward: 1,
    lateral: 1,
    steps: Infinity,
    capture: CaptureMode.ANY,
  }),
  Object.freeze({
    forward: 1,
    lateral: -1,
    steps: Infinity,
    capture: CaptureMode.ANY,
  }),
  Object.freeze({
    forward: -1,
    lateral: 1,
    steps: Infinity,
    capture: CaptureMode.ANY,
  }),
  Object.freeze({
    forward: -1,
    lateral: -1,
    steps: Infinity,
    capture: CaptureMode.ANY,
  }),
]);

/** @type {Readonly<Record<import("./PieceType.js").PieceTypeValue, readonly MovePattern[]>>} */
export const PIECE_MOVE_DEFS = Object.freeze({
  [PieceType.PAWN]: Object.freeze([
    Object.freeze({
      forward: 1,
      lateral: 0,
      steps: 1,
      capture: CaptureMode.NEVER,
    }),
    Object.freeze({
      forward: 1,
      lateral: 0,
      steps: 2,
      capture: CaptureMode.NEVER,
      requires: "unmoved",
    }),
    Object.freeze({
      forward: 1,
      lateral: 1,
      steps: 1,
      capture: CaptureMode.ONLY,
    }),
    Object.freeze({
      forward: 1,
      lateral: -1,
      steps: 1,
      capture: CaptureMode.ONLY,
    }),
  ]),

  // Mã đi chữ L. Bước đơn không có ô ở giữa nên không cần jump.
  [PieceType.KNIGHT]: Object.freeze([
    Object.freeze({
      forward: 2,
      lateral: 1,
      steps: 1,
      capture: CaptureMode.ANY,
    }),
    Object.freeze({
      forward: 2,
      lateral: -1,
      steps: 1,
      capture: CaptureMode.ANY,
    }),
    Object.freeze({
      forward: -2,
      lateral: 1,
      steps: 1,
      capture: CaptureMode.ANY,
    }),
    Object.freeze({
      forward: -2,
      lateral: -1,
      steps: 1,
      capture: CaptureMode.ANY,
    }),
    Object.freeze({
      forward: 1,
      lateral: 2,
      steps: 1,
      capture: CaptureMode.ANY,
    }),
    Object.freeze({
      forward: 1,
      lateral: -2,
      steps: 1,
      capture: CaptureMode.ANY,
    }),
    Object.freeze({
      forward: -1,
      lateral: 2,
      steps: 1,
      capture: CaptureMode.ANY,
    }),
    Object.freeze({
      forward: -1,
      lateral: -2,
      steps: 1,
      capture: CaptureMode.ANY,
    }),
  ]),

  [PieceType.ROOK]: ROOK_MOVES,
  [PieceType.BISHOP]: BISHOP_MOVES,

  // Hậu là xe cộng tượng
  [PieceType.QUEEN]: Object.freeze([...ROOK_MOVES, ...BISHOP_MOVES]),

  // Vua đi một ô theo 8 hướng. Nhập thành không khai báo ở đây
  // vì nó đổi hai quân và cần kiểm tra chiếu, nên nằm trong ChessRule.
  [PieceType.KING]: Object.freeze([
    Object.freeze({
      forward: 1,
      lateral: 0,
      steps: 1,
      capture: CaptureMode.ANY,
    }),
    Object.freeze({
      forward: -1,
      lateral: 0,
      steps: 1,
      capture: CaptureMode.ANY,
    }),
    Object.freeze({
      forward: 0,
      lateral: 1,
      steps: 1,
      capture: CaptureMode.ANY,
    }),
    Object.freeze({
      forward: 0,
      lateral: -1,
      steps: 1,
      capture: CaptureMode.ANY,
    }),
    Object.freeze({
      forward: 1,
      lateral: 1,
      steps: 1,
      capture: CaptureMode.ANY,
    }),
    Object.freeze({
      forward: 1,
      lateral: -1,
      steps: 1,
      capture: CaptureMode.ANY,
    }),
    Object.freeze({
      forward: -1,
      lateral: 1,
      steps: 1,
      capture: CaptureMode.ANY,
    }),
    Object.freeze({
      forward: -1,
      lateral: -1,
      steps: 1,
      capture: CaptureMode.ANY,
    }),
  ]),
});



// export function movesOf(piece) {
//   return PIECE_MOVE_DEFS[piece.type];
// }