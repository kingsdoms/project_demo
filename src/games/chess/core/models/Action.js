/**
 * @file Action.js
 * @author tuanca
 */

import { ActionType } from "../constants/ActionType.js";
import { ErrorCode } from "../constants/ErrorCode.js";
import { PieceType } from "../constants/PieceType.js";
import { GameError } from "../../utils/GameError.js";
import { isStr, isInt, hasKey } from "../../utils/validation.js";

export class Action {
  /**
   * Tạo một hành động trong game.
   *
   * `type` xác định loại hành động, `id` xác định quân cờ liên quan.
   * `row` và `col` là tọa độ đích khi hành động cần di chuyển quân.
   * `pieceType` là loại quân được chọn khi thực hiện phong cấp.
   *
   * Những tham số không áp dụng cho loại hành động tương ứng có thể để `null`.
   *
   * @param {string} type - Loại hành động.
   * @param {string} id - ID quân cờ liên quan đến hành động.
   * @param {number | null} [row=null] - Hàng đích, nếu có.
   * @param {number | null} [col=null] - Cột đích, nếu có.
   * @param {typeof PieceType[keyof typeof PieceType] | null} [pieceType=null] - Loại quân được chọn khi phong cấp.
   */
  constructor(type, id, row = null, col = null, pieceType = null) {
    this.#validate(type, id, row, col, pieceType);
    this.type = type;
    this.id = id;
    this.row = row;
    this.col = col;
    this.pieceType = pieceType;
    Object.freeze(this);
  }

  /**
   * @param {string} type
   * @param {string} id
   * @param {number | null} row
   * @param {number | null} col
   * @param {typeof PieceType[keyof typeof PieceType] | null} [pieceType=null]
   */
  #validate(type, id, row, col, pieceType) {
    switch (type) {
      case ActionType.MOVE:
        if (!isStr(id))
          throw new GameError(ErrorCode.INVALID_ID, "Invalid piece id");
        if (!isInt(row))
          throw new GameError(ErrorCode.INVALID_POSITION, "Invalid row");
        if (!isInt(col))
          throw new GameError(ErrorCode.INVALID_POSITION, "Invalid col");
        break;
      case ActionType.PROMOTE:
        if (!hasKey(PieceType, pieceType))
          throw new GameError(ErrorCode.INVALID_ARGUMENT, "Invalid piece type");
        break;
      default:
        throw new GameError(ErrorCode.INVALID_ARGUMENT, "Invalid action type");
    }
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
   * @param {typeof PieceType[keyof typeof PieceType]} pieceType
   */
  static promote(pieceType) {
    return new Action(ActionType.PROMOTE, "", null, null, pieceType);
  }
}
