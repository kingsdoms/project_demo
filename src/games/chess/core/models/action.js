//ý định đầu vào, chưa kiểm tra

import { ActionType } from "../constants/ActionType.js";
import { ErrorCode } from "../constants/ErrorCode.js";
import { GameError } from "../utils/game-error.js";
import { isStr, isInt } from "../utils/validation.js";

export class Action {
  constructor(type, id, row = null, col = null, pieceType = null) {
    this.#validate(id, row, col, pieceType);
    this.type = type;
    this.id = id;
    this.row = row;
    this.col = col;
    this.pieceType = pieceType;
  }
  #validate(id, row, col, pieceType) {
    if (!isStr(id))
      throw new GameError(ErrorCode.INVALID_ID, "Invalid piece id");

    if (row !== null && !isInt(row))
      throw new GameError(ErrorCode.INVALID_POSITION, "Invalid row");

    if (col !== null && !isInt(col))
      throw new GameError(ErrorCode.INVALID_POSITION, "Invalid col");

    if (pieceType !== null && !isStr(pieceType))
      throw new GameError(ErrorCode.INVALID_PIECE_TYPE, "Invalid piece type");
  }

  static move(id, row, col) {
    return new Action(ActionType.MOVE, id, row, col);
  }

  static promote(id, pieceType) {
    return new Action(ActionType.PROMOTE, id, null, null, pieceType);
  }
}
