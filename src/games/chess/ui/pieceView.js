// ui/pieceView.js
import { PieceType } from "../core/constants/PieceType.js";
import { Side } from "../core/constants/Side.js";

// Dùng bộ ký hiệu "đặc" cho cả hai phe, phân biệt phe bằng màu CSS.
const GLYPH = {
  [PieceType.PAWN]: "♟",
  [PieceType.KNIGHT]: "♞",
  [PieceType.BISHOP]: "♝",
  [PieceType.ROOK]: "♜",
  [PieceType.QUEEN]: "♛",
  [PieceType.KING]: "♚",
};

export const glyphOf = (type) => GLYPH[type] + "\uFE0E";

export const sideName = (side) => (side === Side.WHITE ? "trắng" : "đen");

export const otherSide = (side) => (side === Side.WHITE ? Side.BLACK : Side.WHITE);

// Hàng 0 nằm trên cùng (bên đen), nên hàng cờ = rows - row.
export const squareName = (row, col, rows) =>
  `${String.fromCharCode(97 + col)}${rows - row}`;

const RESULT_LABEL = {
  checkmate: "Chiếu hết",
  stalemate: "Hòa do hết nước đi",
  insufficientMaterial: "Hòa do thiếu quân",
};

// Chấp nhận result là chuỗi ("checkmate") hoặc object ({ type, winner }).
// Chiếu hết mà không ghi winner thì suy ra: bên đang tới lượt là bên thua.
export function describeResult(result, turn) {
  const isObj = typeof result === "object" && result !== null;
  const kind = isObj ? (result.type ?? result.kind ?? result.reason) : result;
  const winner =
    (isObj ? result.winner : null) ??
    (kind === "checkmate" ? otherSide(turn) : null);
  const base = RESULT_LABEL[kind] ?? "Ván đã kết thúc";
  return winner ? `${base}, ${sideName(winner)} thắng` : base;
}