/**
 * @file MoveKind.js
 * @author tuanca
 */

/**
 * @typedef {typeof MoveKind[keyof typeof MoveKind]} MoveKindValue
 *   Giá trị của một loại nước đi, lấy từ hằng `MoveKind`
 *   (ví dụ "CASTLE" | "EN_PASSANT" | "NORMAL").
 */

export const MoveKind = Object.freeze({
  NORMAL: "NORMAL",
  CASTLE: "CASTLE",
  EN_PASSANT: "EN_PASSANT",
});
