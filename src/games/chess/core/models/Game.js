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
  /**
   * Trạng thái hiện tại của một ván cờ.
   *
   * Game quản lý bàn cờ và các thông tin điều khiển ván đấu như lượt đi,
   * mục tiêu bắt tốt qua đường, trạng thái chờ phong cấp và kết quả ván.
   * Các thay đổi trạng thái nên tạo ra một Game mới thay vì sửa đổi Game cũ.
   * 
   * @param {object} options
   * @param {Board} options.board
   * @param {typeof Side[keyof typeof Side]} [options.turn=Side.WHITE]
   * @param {{ row: number, col: number } | null} [options.enPassantTarget=null]
   * @param {string | null} [options.pendingPromotion=null]
   * @param {{ type: string, winner: typeof Side[keyof typeof Side] | null } | null} [options.result=null]
   */
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
    for (const [col, type] of BACK_RANK.entries()) {
      pieces.push(
        new Piece({ type, side: Side.BLACK, row: 0, col }),
        new Piece({ type: PieceType.PAWN, side: Side.BLACK, row: 1, col }),
        new Piece({
          type: PieceType.PAWN,
          side: Side.WHITE,
          row: STANDARD_ROWS - 2,
          col,
        }),
        new Piece({ type, side: Side.WHITE, row: STANDARD_ROWS - 1, col }),
      );
    }
    return new Game({ board: new Board(STANDARD_ROWS, STANDARD_COLS, pieces) });
  }

  /**
   * Trả về Game mới với các trường được cập nhật.
   * Không thay đổi Game hiện tại.
   *
   * @param {Partial<{
   *   board: Board,
   *   turn: typeof Side[keyof typeof Side],
   *   enPassantTarget: { row: number, col: number } | null,
   *   pendingPromotion: string | null,
   *   result: { type: string, winner: typeof Side[keyof typeof Side] | null } | null
   * }>} changes
   * @returns {Game}
   */
  with(changes) {
    return new Game({ ...this, ...changes });
  }
}
