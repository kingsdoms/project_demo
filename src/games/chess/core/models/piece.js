/**
 * @file Piece.js
 * @author tuanca
 */
//quân: dữ liệu quân và bảng loại quân (PIECE_DEFS)
import { Side } from "../../constants/Side.js";
import { PieceType } from "../../constants/PieceType.js";
import { GameError } from "../../utils/GameError.js";
import { isStr, isInt, hasKey } from "../../utils/validation.js";

export class Piece {
  constructor({ id, type, side, row, col, hasMoved = false, ext = {} }) {
    this.#validate(id, type, side, row, col);
    this.id = id;
    this.type = type;
    this.side = side;
    this.row = row;
    this.col = col;
    this.hasMoved = hasMoved;
    this.ext = Object.freeze({ ...ext });
    Object.freeze(this);
  }

  #validate(id, type, side, row, col) {
    if (!isStr(id))
      throw new GameError(ErrorCode.INVALID_ID, "Invalid piece id");

    if (!hasKey(PieceType, type))
      throw new GameError(ErrorCode.INVALID_POSITION, "Invalid piece type");

    if (!hasKey(Side, side))
      throw new GameError(ErrorCode.INVALID_POSITION, "Invalid side");

    if (!isInt(row))
      throw new GameError(ErrorCode.INVALID_POSITION, "Invalid row");

    if (!isInt(col))
      throw new GameError(ErrorCode.INVALID_POSITION, "Invalid col");
  }

  // Trả về quân mới với các trường được thay đổi. dùng trong trường hợp muốn đi thử hoặc đi lại
  // Board — trạng thái hiện tại
  // Game tạo newPiece bằng with()
  // Lưu lịch sử nước đi nếu cần undo
  // Board thay oldPiece bằng newPiece

  static from(data) {
    return data instanceof Piece ? data : new Piece(data);
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

  with(patch) {
    return new Piece({ ...this, ...patch });
  }
}
