/**
 * @file Side.js
 * @author tuanca
 */

/**
 * @typedef {typeof Side[keyof typeof Side]} SideValue
 *   Giá trị của một phe, lấy từ hằng `Side` (ví dụ "WHITE" | "BLACK").
 * @typedef {typeof OPPONENT[keyof typeof OPPONENT]} OpponentValue
 *   Giá trị của `OPPONENT`: phe đối phương của một phe.
 * @typedef {typeof SIDE_SIGN[keyof typeof SIDE_SIGN]} SideSignValue
 *   Giá trị của `SIDE_SIGN`: dấu/hướng của một phe (ví dụ 1 | -1).
 */

export const Side = Object.freeze({
  WHITE: "WHITE",
  BLACK: "BLACK",
});

export const OPPONENT = Object.freeze({
  [Side.WHITE]: Side.BLACK,
  [Side.BLACK]: Side.WHITE,
});

export const SIDE_SIGN = Object.freeze({
  [Side.WHITE]: 1,
  [Side.BLACK]: -1,
});

export function randomSide() {
  return Math.random() < 0.5 ? Side.WHITE : Side.BLACK;
}
