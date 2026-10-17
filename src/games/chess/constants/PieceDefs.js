/**
 * @file PieceDefs.js
 * @author tuanca
 */

import { PieceType } from "./PieceType.js";

//name, value (điểm số khi mà bên kia ăn được)
export const PIECE_DEFS = Object.freeze({
  [PieceType.PAWN]: { name: "Tốt", value: 1 },
  [PieceType.KNIGHT]: { name: "Mã", value: 3 },
  [PieceType.BISHOP]: { name: "Tượng", value: 3 },
  [PieceType.ROOK]: { name: "Xe", value: 5 },
  [PieceType.QUEEN]: { name: "Hậu", value: 9 },
  [PieceType.KING]: { name: "Vua", value: 0 },
});
