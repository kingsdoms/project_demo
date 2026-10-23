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

// RANDOM PHASE

// Giá trị quân để cân bằng lực lượng (KING không tính vì mỗi bên luôn có đúng 1)
const PIECE_VALUE = new Map([
  [PieceType.KING, 0],
  [PieceType.QUEEN, 9],
  [PieceType.ROOK, 5],
  [PieceType.BISHOP, 3],
  [PieceType.KNIGHT, 3],
  [PieceType.PAWN, 1],
]);

// Số quân tối đa mỗi loại cho 1 bên (chỉnh tùy ý)
const MAX_PER_TYPE = new Map([
  [PieceType.QUEEN, 2],
  [PieceType.ROOK, 3],
  [PieceType.BISHOP, 3],
  [PieceType.KNIGHT, 3],
  [PieceType.PAWN, STANDARD_COLS],
]);
