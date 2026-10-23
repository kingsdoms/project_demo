/**
 * @file Board.js
 * @author tuanca
 */

import { Square } from "./Square.js"; // tạm thời chưa dùng
import { ErrorCode } from "../constants/ErrorCode.js";
import { GameError } from "../../utils/GameError.js";
import { isInt } from "../../utils/validation.js";
/**
 * Bàn cờ, quản lý kích thước và danh sách quân cờ.
 *
 * Board chỉ chịu trách nhiệm về cấu trúc và vị trí các quân trên bàn:
 * - Lưu số hàng, số cột và danh sách quân cờ.
 * - Tra cứu quân theo `id`, `row`, `col`; không tự kiểm tra luật đi quân.
 * - Không lưu chỉ mục phụ; các thao tác tra cứu duyệt trực tiếp danh sách quân.
 * - Bất biến: mọi thao tác làm thay đổi bàn cờ đều trả về một `Board` mới,
 *   không sửa đổi `Board` hiện tại.
 */
export class Board {
  /**
   * @param {number} rows - Số hàng của bàn cờ.
   * @param {number} cols - Số cột của bàn cờ.
   * @param {import("./Piece.js").Piece[]} [pieces=[]] - Danh sách quân cờ ban đầu.
   */
  constructor(rows, cols, pieces = []) {
    this.#validate(rows, cols, pieces);
    this.rows = rows;
    this.cols = cols;
    this.pieces = Object.freeze([...pieces]);
    // this.squares = [][]Square;
    Object.freeze(this);
  }

  /**
   * @param {number} rows
   * @param {number} cols
   * @param {import("./Piece.js").Piece[]} pieces
   */
  #validate(rows, cols, pieces) {
    if (!isInt(rows) || rows <= 0)
      throw new GameError(ErrorCode.INVALID_ARGUMENT, "Invalid rows");
    if (!isInt(cols) || cols <= 0)
      throw new GameError(ErrorCode.INVALID_ARGUMENT, "Invalid cols");
    //
    const occupied = new Set();
    for (const p of pieces) {
      if (p.row >= rows || p.col >= cols)
        throw new GameError(
          ErrorCode.INVALID_ARGUMENT,
          `Quân ${p.id} nằm ngoài bàn`,
        );
      // check trùng vị trí
      const position = `${p.row},${p.col}`;
      if (occupied.has(position))
        throw new GameError(
          ErrorCode.INVALID_ARGUMENT,
          `Hai quân cùng ô (${position})`,
        );
      occupied.add(position);
    }
  }

  /**
   * Kiểm tra tọa độ có nằm trong phạm vi bàn cờ không.
   * @param {number} row
   * @param {number} col
   * @returns {boolean}
   */
  inBounds(row, col) {
    return (
      isInt(row) &&
      isInt(col) &&
      row >= 0 &&
      row < this.rows &&
      col >= 0 &&
      col < this.cols
    );
  }

  /**
   * Tìm quân cờ tại tọa độ, trả về null nếu không có quân.
   * @param {number} row
   * @param {number} col
   * @returns {import("./Piece.js").Piece | null}
   */
  pieceAt(row, col) {
    return this.pieces.find((p) => p.row === row && p.col === col) ?? null;
  }

  /**
   * Tìm quân cờ theo ID, trả về null nếu không tìm thấy.
   * @param {string} id
   * @returns {import("./Piece.js").Piece | null}
   */
  pieceById(id) {
    return this.pieces.find((p) => p.id === id) ?? null;
  }

  /**
   * Duyệt các ô theo một hướng, không bao gồm ô xuất phát.
   * Dừng khi ra ngoài bàn, vượt quá maxSteps hoặc gặp quân đầu tiên.
   *
   * @param {number} sRow
   * @param {number} sCol
   * @param {number} dRow
   * @param {number} dCol
   * @param {number} [maxSteps=Infinity]
   * @returns {{ row: number, col: number, piece: import("./Piece.js").Piece | null }[]}
   */
  ray(sRow, sCol, dRow, dCol, maxSteps = Infinity) {
    if (!this.inBounds(sRow, sCol))
      throw new GameError(
        ErrorCode.INVALID_POSITION,
        `Ô xuất phát (${sRow},${sCol}) nằm ngoài bàn`,
      );
    //
    if (!isInt(dRow) || !isInt(dCol) || (dRow === 0 && dCol === 0))
      throw new GameError(
        ErrorCode.BAD_ACTION,
        "Hướng phải là cặp số nguyên khác (0,0)",
      );
    //
    if (maxSteps !== Infinity && !(isInt(maxSteps) && maxSteps >= 1)) {
      throw new GameError(
        ErrorCode.BAD_ACTION,
        "maxSteps phải là số nguyên từ 1 trở lên, hoặc Infinity",
      );
    }

    const out = [];
    let row = sRow + dRow;
    let col = sCol + dCol;
    while (this.inBounds(row, col) && out.length < maxSteps) {
      const piece = this.pieceAt(row, col);
      out.push({ row, col, piece });
      if (piece !== null) break;
      row += dRow;
      col += dCol;
    }
    return out;
  }

  /**
   * Trả về Board mới có thêm quân cờ, không thay đổi Board hiện tại.
   * @param {import("./Piece.js").Piece} piece
   * @returns {Board}
   */
  add(piece) {
    return new Board(this.rows, this.cols, [...this.pieces, piece]);
  }

  /**
   * Trả về Board mới, thay quân cờ có cùng ID bằng piece.
   * Ném lỗi nếu ô đích đang bị chiếm bởi quân cờ khác.
   *
   * @param {import("./Piece.js").Piece} piece
   * @returns {Board}
   */
  replace(piece) {
    if (this.pieceById(piece.id) === null)
      throw new GameError(
        ErrorCode.BAD_ACTION,
        `Không có quân ${piece.id} để thay`,
      );
    const next = this.pieces.map((p) => (p.id === piece.id ? piece : p));
    return new Board(this.rows, this.cols, next);
  }

  /**
   * Trả về Board mới sau khi loại bỏ quân cờ có ID tương ứng.
   * Không thay đổi Board hiện tại.
   *
   * @param {string} id
   * @returns {Board}
   */
  remove(id) {
    if (this.pieceById(id) === null)
      throw new GameError(ErrorCode.BAD_ACTION, `Không có quân ${id} để xóa`);
    return new Board(
      this.rows,
      this.cols,
      this.pieces.filter((p) => p.id !== id),
    );
  }
}
