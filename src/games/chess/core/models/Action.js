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
  constructor(type, id, row = null, col = null, pieceType = null) {
    this.#validate(type, id, row, col, pieceType);
    this.type = type;
    this.id = id;
    this.row = row;
    this.col = col;
    this.pieceType = pieceType;
    Object.freeze(this);
  }
  #validate(type, id, row, col, pieceType) {
    if (!isStr(id))
      throw new GameError(ErrorCode.INVALID_ID, "Invalid piece id");

    switch (type) {
      case ActionType.MOVE:
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
        break;
    }
  }

  static move(id, row, col) {
    return new Action(ActionType.MOVE, id, row, col);
  }

  static promote(id, pieceType) {
    return new Action(ActionType.PROMOTE, id, null, null, pieceType);
  }
}
