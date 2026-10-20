/**
 * @file Game.js
 * @author tuanca
 */

import { Side } from "../constants/Side.js";
import { PieceType } from "../constants/PieceType.js";
import { Board } from "./Board.js";
import { Piece } from "./Piece.js";
import {
  BACK_RANK,
  STANDARD_ROWS,
  STANDARD_COLS,
} from "../constants/StandardDef.js";

export class Game {
  constructor({
    board,
    turn = Side.WHITE,
    enPassantTarget = null,
    pendingPromotion = null,
    result = null,
  }) {
    this.board = board;
    this.turn = turn;
    this.enPassantTarget = enPassantTarget;
    this.pendingPromotion = pendingPromotion;
    this.result = result;

    Object.freeze(this);
  }

  // Tạo ván mới ở thế ban đầu. room.restart() gọi hàm này.
  static initialStandard() {
    const pieces = [];
    for (const [i, type] of BACK_RANK.entries()) {
      pieces.push(
        new Piece(type, Side.BLACK, 0, i),
        new Piece(PieceType.PAWN, Side.BLACK, 1, i),
        new Piece(PieceType.PAWN, Side.WHITE, STANDARD_ROWS - 2, i),
        new Piece(type, Side.WHITE, STANDARD_ROWS - 1, i),
      );
    }
    return new Game({
      board: new Board(STANDARD_ROWS, STANDARD_COLS, pieces),
    });
  }

  // Các hàm cập nhật: trả Game mới, Game cũ không đổi.
  withBoard(board) {
    return new Game({ ...this, board });
  }

  withTurn(turn) {
    return new Game({ ...this, turn });
  }

  withEnPassantTarget(enPassantTarget) {
    return new Game({ ...this, enPassantTarget });
  }

  withPendingPromotion(pendingPromotion) {
    return new Game({ ...this, pendingPromotion });
  }
  with(changes) {
    return new Game({ ...this, ...changes });
  }
}
