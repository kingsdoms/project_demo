/**
 * @file Piece.js
 * @author tuanca
 */



/**
 * Đại diện cho một quân cờ trên bàn cờ.
 *
 * Piece lưu loại quân, bên sở hữu, vị trí hiện tại và thông tin
 * quân đã di chuyển hay chưa. Không tự kiểm tra luật đi quân;
 * việc xác định nước đi hợp lệ thuộc về hệ thống luật của game.
 */
export class Piece {
  /**
   * @param {object} options
   * @param {import("../constants/PieceType.js").PieceTypeValue} options.type
   * @param {import("../constants/Side.js").SideValue} options.side
   * @param {number} options.row
   * @param {number} options.col
   * @param {boolean} [options.hasMoved=false]
   */
  constructor({ type, side, row, col, hasMoved = false }) {
    this.id = `${type}-${side}-${row}-${col}`;
    this.type = type;
    this.side = side;
    this.row = row;
    this.col = col;
    this.hasMoved = hasMoved;
    Object.freeze(this);
  }

  /**
   * Trả về quân cờ mới với các trường được cập nhật.
   * Không thay đổi quân cờ hiện tại.
   *
   * @param {Partial<{
   *   type: import("../constants/PieceType.js").PieceTypeValue,
   *   side: import("../constants/Side.js").SideValue,
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
