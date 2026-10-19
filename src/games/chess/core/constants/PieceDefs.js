/**
 * @file PieceDefs.js
 * @author tuanca
 */

import { PieceType } from "./PieceType.js";
const P = (pattern) => Object.freeze(pattern);

//value điểm khi bị bắt
export const PIECE_DEFS = P({
  [PieceType.PAWN]: P({
    name: "Tốt",
    value: 1, 
    canPromote: true,
    royal: false,
  }),
  [PieceType.KNIGHT]: P({
    name: "Mã",
    value: 3,
    canPromote: false,
    royal: false,
  }),
  [PieceType.BISHOP]: P({
    name: "Tượng",
    value: 3,
    canPromote: false,
    royal: false,
  }),
  [PieceType.ROOK]: P({
    name: "Xe",
    value: 5,
    canPromote: false,
    royal: false,
  }),
  [PieceType.QUEEN]: P({
    name: "Hậu",
    value: 9,
    canPromote: false,
    royal: false,
  }),
  [PieceType.KING]: P({
    name: "Vua",
    value: 0,
    canPromote: false,
    royal: true,
  }),
});
