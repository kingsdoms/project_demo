/**
 * @file Square.js
 * @author tuanca
 */

export class Square {
  /**
   * Đại diện cho một ô trên bàn cờ.
   *
   * Square lưu tọa độ hàng, cột và quân cờ đang chiếm ô đó, nếu có.
   * Chỉ mô tả vị trí và trạng thái chiếm ô, không kiểm tra luật di chuyển
   * hay quyết định nước đi có hợp lệ hay không.
   *
   * @param {number} row - Chỉ số hàng của ô trên bàn cờ.
   * @param {number} col - Chỉ số cột của ô trên bàn cờ.
   * @param {import("./Piece.js").Piece | null} [occupant=null] - Quân cờ đang ở ô này, hoặc `null` nếu ô trống.
   */
  constructor(row, col, occupant = null) {
    this.row = row;
    this.col = col;
    this.occupant = occupant;
  }

  isEmpty() {
    return this.occupant === null;
  }

  hasPiece() {
    return this.occupant !== null;
  }
}
