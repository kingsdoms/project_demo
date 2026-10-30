/**
 * @file Square.js
 * @author tuanca
 */

/**
 * Đại diện cho một ô trên bàn cờ.
 *
 * Square lưu tọa độ hàng, cột 
 * Chỉ mô tả vị trí và trạng thái chiếm ô, không kiểm tra luật di chuyển
 * hay quyết định nước đi có hợp lệ hay không.
 */
export class Square {
  /**
   * @param {object} options
   * @param {number} options.row - Chỉ số hàng của ô trên bàn cờ.
   * @param {number} options.col - Chỉ số cột của ô trên bàn cờ.
   */
  constructor({ row, col }) {
    this.row = row;
    this.col = col;
    Object.freeze(this);
  }

  get key() {
    return this.row * 8 + this.col;
  }

  /**
   * @param {Partial<{
   *   row: number,
   *   col: number,
   *   occupant: import("./Piece.js").Piece | null
   * }>} changes
   * @returns {Square}
   */
  with(changes) {
    return new Square({ ...this, ...changes });
  }
}
