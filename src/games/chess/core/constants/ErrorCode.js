/**
 * @file ErrorCode.js
 * @author tuanca
 */

/**
 * @typedef {typeof ErrorCode[keyof typeof ErrorCode]} ErrorCodeValue
 *   Giá trị của một mã lỗi, lấy từ hằng `ErrorCode`.
 */

export const ErrorCode = Object.freeze({
  // Action / Game
  BAD_ACTION: "BAD_ACTION",
  GAME_OVER: "GAME_OVER",
  PROMOTION_PENDING: "PROMOTION_PENDING",
  NO_PROMOTION_PENDING: "NO_PROMOTION_PENDING",

  // Piece
  UNKNOWN_PIECE: "UNKNOWN_PIECE",
  INVALID_ID: "INVALID_ID",
  INVALID_PIECE_TYPE: "INVALID_PIECE_TYPE",
  INVALID_SIDE: "INVALID_SIDE",
  INVALID_POSITION: "INVALID_POSITION",

  // Rule / Move
  NOT_YOUR_PIECE: "RULE.NOT_YOUR_PIECE",
  NOT_YOUR_TURN: "RULE.NOT_YOUR_TURN",
  ILLEGAL_MOVE: "RULE.ILLEGAL_MOVE",
  SELF_CHECK: "RULE.SELF_CHECK",
  CASTLE_ILLEGAL: "RULE.CASTLE_ILLEGAL",

  // Internal / general
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
  INVALID_STATE: "INVALID_STATE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
});
