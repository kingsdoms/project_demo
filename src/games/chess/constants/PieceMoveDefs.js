/**
 * @file PieceMoveDefs.js
 * @author tuanca
 */

import { PieceType } from "./PieceType.js";
import { CaptureMode } from "./CaptureMode.js";

// Freeze từng pattern để object con không bị sửa sau khi load
const P = (pattern) => Object.freeze(pattern);

// Viết từ góc nhìn bên trắng: forward dương là tiến về phía đối phương.
// ChessRule sẽ đảo cả forward lẫn lateral khi đọc cho bên đen.

// steps: số lần lặp vector (forward, lateral) trong pattern
//   1         → đi đúng 1 ô
//   2         → đi 2 ô theo hướng đó
//   Infinity  → đi tiếp cho đến khi gặp quân hoặc hết bàn (xe, tượng, hậu)
//
// Khi steps > 1, mọi ô ở giữa phải trống.
// Ví dụ: tốt đi 2 ô, nếu ô ngay phía trước có quân thì nước đó bị chặn.
// Mã chỉ có steps = 1 nên không có ô giữa để kiểm tra.
//
// Ô đích được kiểm tra theo capture (xem CaptureMode).

const ROOK_MOVES = Object.freeze([
  P({ forward: 1, lateral: 0, steps: Infinity, capture: CaptureMode.ANY }),
  P({ forward: -1, lateral: 0, steps: Infinity, capture: CaptureMode.ANY }),
  P({ forward: 0, lateral: 1, steps: Infinity, capture: CaptureMode.ANY }),
  P({ forward: 0, lateral: -1, steps: Infinity, capture: CaptureMode.ANY }),
]);

const BISHOP_MOVES = Object.freeze([
  P({ forward: 1, lateral: 1, steps: Infinity, capture: CaptureMode.ANY }),
  P({ forward: 1, lateral: -1, steps: Infinity, capture: CaptureMode.ANY }),
  P({ forward: -1, lateral: 1, steps: Infinity, capture: CaptureMode.ANY }),
  P({ forward: -1, lateral: -1, steps: Infinity, capture: CaptureMode.ANY }),
]);

export const PIECE_MOVE_DEFS = Object.freeze({
  [PieceType.PAWN]: Object.freeze([
    P({ forward: 1, lateral: 0, steps: 1, capture: CaptureMode.NEVER }),
    P({
      forward: 1,
      lateral: 0,
      steps: 2,
      capture: CaptureMode.NEVER,
      requires: "unmoved",
    }),
    P({ forward: 1, lateral: 1, steps: 1, capture: CaptureMode.ONLY }),
    P({ forward: 1, lateral: -1, steps: 1, capture: CaptureMode.ONLY }),
  ]),

  // Mã đi chữ L. Bước đơn không có ô ở giữa nên không cần jump.
  [PieceType.KNIGHT]: Object.freeze([
    P({ forward: 2, lateral: 1, steps: 1, capture: CaptureMode.ANY }),
    P({ forward: 2, lateral: -1, steps: 1, capture: CaptureMode.ANY }),
    P({ forward: -2, lateral: 1, steps: 1, capture: CaptureMode.ANY }),
    P({ forward: -2, lateral: -1, steps: 1, capture: CaptureMode.ANY }),
    P({ forward: 1, lateral: 2, steps: 1, capture: CaptureMode.ANY }),
    P({ forward: 1, lateral: -2, steps: 1, capture: CaptureMode.ANY }),
    P({ forward: -1, lateral: 2, steps: 1, capture: CaptureMode.ANY }),
    P({ forward: -1, lateral: -2, steps: 1, capture: CaptureMode.ANY }),
  ]),

  [PieceType.ROOK]: ROOK_MOVES,
  [PieceType.BISHOP]: BISHOP_MOVES,

  // Hậu là xe cộng tượng
  [PieceType.QUEEN]: Object.freeze([...ROOK_MOVES, ...BISHOP_MOVES]),

  // Vua đi một ô theo 8 hướng. Nhập thành không khai báo ở đây
  // vì nó đổi hai quân và cần kiểm tra chiếu, nên nằm trong ChessRule.
  [PieceType.KING]: Object.freeze([
    P({ forward: 1, lateral: 0, steps: 1, capture: CaptureMode.ANY }),
    P({ forward: -1, lateral: 0, steps: 1, capture: CaptureMode.ANY }),
    P({ forward: 0, lateral: 1, steps: 1, capture: CaptureMode.ANY }),
    P({ forward: 0, lateral: -1, steps: 1, capture: CaptureMode.ANY }),
    P({ forward: 1, lateral: 1, steps: 1, capture: CaptureMode.ANY }),
    P({ forward: 1, lateral: -1, steps: 1, capture: CaptureMode.ANY }),
    P({ forward: -1, lateral: 1, steps: 1, capture: CaptureMode.ANY }),
    P({ forward: -1, lateral: -1, steps: 1, capture: CaptureMode.ANY }),
  ]),
});

export function movesOf(piece) {
  return PIECE_MOVE_DEFS[piece.type];
}
