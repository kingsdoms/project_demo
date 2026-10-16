//quân: dữ liệu quân và bảng loại quân (PIECE_DEFS)
import { Side } from "../constants/Side.js";
import { PIECE_DEFS } from "../constants/PieceDefs.js";
import { GameError } from "../utils/game-error.js";
import { isStr, isInt } from "../utils/validation.js";


export class Piece {
  constructor({ id, type, side, row, col, hasMoved = false, ext = {} }) {
    if (!id) throw new Error("Piece: thiếu id");
    if (!Object.hasOwn(PIECE_DEFS, type)) {
      throw new Error(`Piece: loại quân "${type}" không tồn tại`);
    }
    if (!Object.values(Side).includes(side)) {
      throw new Error(`Piece: phe "${side}" không hợp lệ`);
    }

    this.id = id;
    this.type = type;
    this.Side = Side;
    this.row = row;
    this.col = col;
    this.hasMoved = hasMoved;
    this.ext = Object.freeze({ ...ext });

    Object.freeze(this);
  }

  // Trả về quân mới với các trường được thay đổi. dùng trong trường hợp muốn đi thử hoặc đi lại
  with(patch) {
    return new Piece({ ...this, ...patch });
  }

  static from(data) {
    return data instanceof Piece ? data : new Piece(data);
  }
}
