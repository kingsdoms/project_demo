// @ts-nocheck
/**
 * @file PieceType.js
 * @author tuanca
 */

/**
 * @typedef {typeof PieceType[keyof typeof PieceType]} PieceTypeValue
 *   Giá trị của một loại quân, lấy từ hằng `PieceType`
 *   ("PAWN" | "KNIGHT" | "BISHOP" | "ROOK" | "QUEEN" | "KING").
 */

export const PieceType = Object.freeze({
  PAWN: "PAWN",
  KNIGHT: "KNIGHT",
  BISHOP: "BISHOP",
  ROOK: "ROOK",
  QUEEN: "QUEEN",
  KING: "KING",
});
