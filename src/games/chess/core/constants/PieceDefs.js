/**
 * @file PieceDefs.js
 * @author tuanca
 */
import { PieceType } from "./PieceType.js";

/**
 * Định nghĩa tĩnh của một loại quân.
 *
 * @typedef {Object} PieceDef
 * @property {string} name - Tên hiển thị của quân (ví dụ "Tốt").
 * @property {number} value - Giá trị quân (tốt = 1).
 * @property {boolean} canPromote - `true` nếu quân có thể phong cấp (chỉ tốt).
 * @property {boolean} royal - `true` nếu là quân vua (mất quân này là thua).
 */

/** @type {Readonly<Record<import("./PieceType.js").PieceTypeValue, Readonly<PieceDef>>>} */
export const PIECE_DEFS = Object.freeze({
  [PieceType.PAWN]: Object.freeze({
    name: "Tốt",
    value: 1,
    canPromote: true,
    royal: false,
  }),
  [PieceType.KNIGHT]: Object.freeze({
    name: "Mã",
    value: 3,
    canPromote: false,
    royal: false,
  }),
  [PieceType.BISHOP]: Object.freeze({
    name: "Tượng",
    value: 3,
    canPromote: false,
    royal: false,
  }),
  [PieceType.ROOK]: Object.freeze({
    name: "Xe",
    value: 5,
    canPromote: false,
    royal: false,
  }),
  [PieceType.QUEEN]: Object.freeze({
    name: "Hậu",
    value: 9,
    canPromote: false,
    royal: false,
  }),
  [PieceType.KING]: Object.freeze({
    name: "Vua",
    value: 0,
    canPromote: false,
    royal: true,
  }),
});

