/**
 * @file Piece.js
 * @author tuanca
 */
//quân: dữ liệu quân và bảng loại quân (PIECE_DEFS)
import { Side } from "../constants/Side.js";
import { PieceType } from "../constants/PieceType.js";
import { ErrorCode } from "../constants/ErrorCode.js";
import { GameError } from "../../utils/GameError.js";
import { isInt, hasKey } from "../../utils/validation.js";

export class Piece {
  constructor(type, side, row, col, hasMoved = false, ext = {}) {
    this.#validate(type, side, row, col);
    this.id = `${type}-${side}-${row}-${col}`;
    this.type = type;
    this.side = side;
    this.row = row;
    this.col = col;
    this.hasMoved = hasMoved;
    this.ext = Object.freeze({ ...ext });
    Object.freeze(this);
  }

  #validate(type, side, row, col) {
    if (!hasKey(PieceType, type))
      throw new GameError(ErrorCode.INVALID_POSITION, "Invalid piece type");

    if (!hasKey(Side, side))
      throw new GameError(ErrorCode.INVALID_POSITION, "Invalid side");

    if (!isInt(row) || row < 0)
      throw new GameError(ErrorCode.INVALID_POSITION, "Invalid row");

    if (!isInt(col) || col < 0)
      throw new GameError(ErrorCode.INVALID_POSITION, "Invalid col");
  }

  static from(data) {
    return data instanceof Piece
      ? data
      : new Piece(
          data.type,
          data.side,
          data.row,
          data.col,
          data.hasMoved,
          data.ext,
        );
  }

  to() {
    return {
      id: this.id,
      type: this.type,
      side: this.side,
      row: this.row,
      col: this.col,
      hasMoved: this.hasMoved,
      ext: { ...this.ext },
    };
  }

  // Trả về quân mới với các trường được thay đổi. dùng trong trường hợp muốn đi thử hoặc đi lại
  // Board — trạng thái hiện tại
  // Game tạo newPiece bằng with()
  // Lưu lịch sử nước đi nếu cần undo
  // Board thay oldPiece bằng newPiece
  with(patch) {
    const d = { ...this.to(), ...patch };
    return new Piece(d.type, d.side, d.row, d.col, d.hasMoved, d.ext);
  }
}
