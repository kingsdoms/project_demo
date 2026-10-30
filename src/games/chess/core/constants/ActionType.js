/**
 * @file ActionType.js
 * @author tuanca
 */

/**
 * @typedef {typeof ActionType[keyof typeof ActionType]} ActionTypeValue
 *   Giá trị của một loại hành động, lấy từ hằng `ActionType`.
 */

export const ActionType = Object.freeze({
  MOVE: "MOVE",
  PROMOTE: "PROMOTE",
});
