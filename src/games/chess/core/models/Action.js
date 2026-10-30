/**
 * @file Action.js
 * @author tuanca
 */

import { ActionType } from "../constants/ActionType.js";

/**
 * Tạo một hành động trong game.
 *
 * `type` xác định loại hành động, `id` xác định quân cờ liên quan.
 * `row` và `col` là tọa độ đích khi hành động cần di chuyển quân.
 * `pieceType` là loại quân được chọn khi thực hiện phong cấp.
 *
 */
export class Action {
  /**
   * @param {string} type - Loại hành động.
   * @param {string} id - ID quân cờ liên quan đến hành động.
   * @param {number | null} [row=null] - Hàng đích, nếu có.
   * @param {number | null} [col=null] - Cột đích, nếu có.
   * @param {import("../constants/PieceType.js").PieceTypeValue | null} [pieceType=null] - Loại quân được chọn khi phong cấp.
   */
  constructor(type, id, row = null, col = null, pieceType = null) {
    this.type = type;
    this.id = id;
    this.row = row;
    this.col = col;
    this.pieceType = pieceType;
    Object.freeze(this);
  }

  /**
   * @param {string} id
   * @param {number} row
   * @param {number} col
   */
  static move(id, row, col) {
    return new Action(ActionType.MOVE, id, row, col);
  }

  /**
   * @param {import("../constants/PieceType.js").PieceTypeValue} pieceType
   */
  static promote(pieceType) {
    return new Action(ActionType.PROMOTE, "", null, null, pieceType);
  }
}
