/**
 * @file Piece.js
 * @author tuanca
 */
import { Side } from "../constants/Side.js";
import { PieceType } from "../constants/PieceType.js";
import { ErrorCode } from "../constants/ErrorCode.js";
import { GameError } from "../../utils/GameError.js";
import { isInt, hasKey } from "../../utils/validation.js";

export class Piece {
  /**
   * Đại diện cho một quân cờ trên bàn cờ.
   *
   * Piece lưu loại quân, bên sở hữu, vị trí hiện tại và thông tin
   * quân đã di chuyển hay chưa. Không tự kiểm tra luật đi quân;
   * việc xác định nước đi hợp lệ thuộc về hệ thống luật của game.
   *
   * @param {object} options
   * @param {typeof PieceType[keyof typeof PieceType]} options.type
   * @param {typeof Side[keyof typeof Side]} options.side
   * @param {number} options.row
   * @param {number} options.col
   * @param {boolean} [options.hasMoved=false]
   */
  constructor({ type, side, row, col, hasMoved = false }) {
    this.#validate(type, side, row, col);
    this.id = `${type}-${side}-${row}-${col}`;
    this.type = type;
    this.side = side;
    this.row = row;
    this.col = col;
    this.hasMoved = hasMoved;
    Object.freeze(this);
  }
  /**
   * @param {typeof PieceType[keyof typeof PieceType]} type
   * @param {typeof Side[keyof typeof Side]} side
   * @param {number} row
   * @param {number} col
   */

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
  /**
   * Trả về quân cờ mới với các trường được cập nhật.
   * Không thay đổi quân cờ hiện tại.
   *
   * @param {Partial<{
   *   type: typeof PieceType[keyof typeof PieceType],
   *   side: typeof Side[keyof typeof Side],
   *   row: number,
   *   col: number,
   *   hasMoved: boolean
   * }>} changes
   * @returns {Piece}
   */
  with(changes) {
    return new Piece({ ...this, ...changes });
  }
}
