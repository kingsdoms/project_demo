// @ts-nocheck
/**
 * @file StandardDef.js
 * @author tuanca
 */
import { Side } from "./Side.js";
import { PieceType } from "./PieceType.js";

export const STANDARD_ROWS = 8;
export const STANDARD_COLS = 8;

export const BACK_RANK = [
  PieceType.ROOK,
  PieceType.KNIGHT,
  PieceType.BISHOP,
  PieceType.QUEEN,
  PieceType.KING,
  PieceType.BISHOP,
  PieceType.KNIGHT,
  PieceType.ROOK,
];

export const PROMOTION_RANK = {
  [Side.WHITE]: 0,
  [Side.BLACK]: 7,
};

export const PROMOTION_TARGETS = [
  PieceType.QUEEN,
  PieceType.ROOK,
  PieceType.BISHOP,
  PieceType.KNIGHT,
];
