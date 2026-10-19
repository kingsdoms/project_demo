/**
 * @file Board.js
 * @author tuanca
 */
// Bàn cờ: kích thước và danh sách quân. Board chỉ biết hình học, không biết luật cờ.
// Board bất biến: mọi thay đổi trả về Board mới, Board cũ không đổi.
// Board chỉ đọc id, row, col của quân. Không lưu chỉ mục, mọi tra cứu là duyệt danh sách quân.
import { ErrorCode } from "../constants/ErrorCode.js";
import { GameError } from "../../utils/GameError.js";
import { isInt } from "../../utils/validation.js";

export class Board {
  #rows;
  #cols;
  #pieces;

  constructor(rows, cols, pieces = []) {
    this.#validate(rows, cols, pieces);
    this.#rows = rows;
    this.#cols = cols;
    this.#pieces = Object.freeze([...pieces]);
    Object.freeze(this);
  }

  #validate(rows, cols, pieces) {
    if (!isInt(rows) || rows <= 0)
      throw new GameError(ErrorCode.INVALID_ARGUMENT, "Invalid rows");
    if (!isInt(cols) || cols <= 0)
      throw new GameError(ErrorCode.INVALID_ARGUMENT, "Invalid cols");
    //
    const occupied = new Set();
    for (const p of pieces) {
      if (p.row > rows || p.col > cols)
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

  // Có nằm trong phạm vi của bàn
  inBounds(row, col) {
    return (
      isInt(row) &&
      isInt(col) &&
      row >= 0 &&
      row < this.#rows &&
      col >= 0 &&
      col < this.#cols
    );
  }

  // Tìm quân theo vị trí, hoặc null
  pieceAt(row, col) {
    return this.#pieces.find((p) => p.row === row && p.col === col) ?? null;
  }

  // Tìm quân có id đó, hoặc null
  pieceById(id) {
    return this.#pieces.find((p) => p.id === id) ?? null;
  }

  // Các ô theo một hướng từ (row, col), không tính ô xuất phát.
  // Dừng khi ra khỏi bàn, hoặc ngay sau ô có quân đầu tiên.
  // Ô có quân được trả về kèm quân đó. Tầng luật quyết định ăn được hay bị chặn.
  ray(row, col, dRow, dCol, maxSteps = Infinity) {
    if (!this.inBounds(row, col))
      throw new GameError(
        ErrorCode.INVALID_POSITION,
        `Ô xuất phát (${row},${col}) nằm ngoài bàn`,
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

    const squares = [];
    let r = row + dRow;
    let c = col + dCol;
    while (this.inBounds(r, c) && squares.length < maxSteps) {
      const occupant = this.pieceAt(r, c);
      squares.push({ row: r, col: c, occupant });
      if (occupant !== null) break;
      r += dRow;
      c += dCol;
    }
    return squares;
  }

  // Trả về Board mới có thêm quân
  add(piece) {
    return new Board(this.#rows, this.#cols, [...this.#pieces, piece]);
  }

  // Trả về Board mới với quân cùng id được thay bằng piece.
  // Nếu ô mới đang có quân khác thì constructor báo lỗi.
  replace(piece) {
    if (this.pieceById(piece.id) === null)
      throw new GameError(
        ErrorCode.BAD_ACTION,
        `Không có quân ${piece.id} để thay`,
      );
    const next = this.#pieces.map((p) => (p.id === piece.id ? piece : p));
    return new Board(this.#rows, this.#cols, next);
  }

  // Trả về Board mới không còn quân có id đó
  remove(id) {
    if (this.pieceById(id) === null)
      throw new GameError(ErrorCode.BAD_ACTION, `Không có quân ${id} để xóa`);
    return new Board(
      this.#rows,
      this.#cols,
      this.#pieces.filter((p) => p.id !== id),
    );
  }
}
