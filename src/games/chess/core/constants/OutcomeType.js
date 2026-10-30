/**
 * @file OutcomeType.js
 * @author tuanca
 */

/**
 * @typedef {typeof OutcomeType[keyof typeof OutcomeType]} OutcomeTypeValue
 *   Giá trị của một loại kết cục ván cờ:
 *   "CHECKMATE" | "STALEMATE" | "INSUFFICIENT_MATERIAL".
 *   - "CHECKMATE": chiếu hết, có phe thắng.
 *   - "STALEMATE": hết nước đi nhưng không bị chiếu, hoà.
 *   - "INSUFFICIENT_MATERIAL": không đủ quân để chiếu hết, hoà.
 */

export const OutcomeType = Object.freeze({
  CHECKMATE: "CHECKMATE",
  STALEMATE: "STALEMATE",
  INSUFFICIENT_MATERIAL: "INSUFFICIENT_MATERIAL",
});
