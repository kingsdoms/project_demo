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

import { OutcomeType } from "../core/constants/OutcomeType.js";

const RESULT_LABEL = {
  [OutcomeType.CHECKMATE]: "Chiếu hết",
  [OutcomeType.STALEMATE]: "Hòa do hết nước đi",
  [OutcomeType.INSUFFICIENT_MATERIAL]: "Hòa do thiếu quân",
};

// result có dạng { type, winner } (Game.result). Chiếu hết mà không ghi winner thì suy ra:
// bên đang tới lượt là bên bị chiếu hết, tức bên thua.
export function describeResult(result, turn) {
  const kind = result?.type;
  const winner =
    result?.winner ?? (kind === OutcomeType.CHECKMATE ? otherSide(turn) : null);
  const base = RESULT_LABEL[kind] ?? "Ván đã kết thúc";
  return winner ? `${base}, ${sideName(winner)} thắng` : base;
}