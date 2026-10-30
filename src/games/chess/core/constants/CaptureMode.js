/**
 * @file CaptureMode.js
 * @author tuanca
 */

/**
 * @typedef {typeof CaptureMode[keyof typeof CaptureMode]} CaptureModeValue
 *   Giá trị của một chế độ ăn quân: "ANY" | "ONLY" | "NEVER".
 *   - "ANY": đến ô trống hoặc ăn quân địch (xe, tượng, hậu, vua, mã).
 *   - "ONLY": chỉ đến ô có quân địch để ăn (tốt đi chéo).
 *   - "NEVER": chỉ đến ô trống, không ăn (tốt đi thẳng).
 */

export const CaptureMode = Object.freeze({
  ANY: "ANY",
  ONLY: "ONLY",
  NEVER: "NEVER",
});
