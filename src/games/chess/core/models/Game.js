/**
 * @file Game.js
 * @author tuanca
 */

import { Side } from "../constants/Side.js";
import { PieceType } from "../constants/PieceType.js";
import { PIECE_DEFS } from "../constants/PieceDefs.js";

import { Board } from "./Board.js";
import { Piece } from "./Piece.js";
import { Square } from "./Square.js";

import {
  BACK_RANK,
  STANDARD_ROWS,
  STANDARD_COLS,
} from "../constants/StandardDef.js";

/**
 * @typedef {import("../constants/Side.js").SideValue} SideValue
 * 
 * @typedef {Object} EnPassantTarget
 * @property {number} row - Hàng của ô mà tốt đối phương có thể bắt qua đường.
 * @property {number} col - Cột của ô mà tốt đối phương có thể bắt qua đường.

 * @typedef {Object} OutcomeResult
 * @property {import("../constants/OutcomeType.js").OutcomeTypeValue} type - Loại kết quả, ví dụ "checkmate", "stalemate".
 * @property {SideValue | null} winner - Phe thắng, hoặc `null` nếu hoà.
 */

/**
 * Trạng thái hiện tại của một ván cờ.
 *
 * Game quản lý bàn cờ và các thông tin điều khiển ván đấu như lượt đi,
 * mục tiêu bắt tốt qua đường, trạng thái chờ phong cấp và kết quả ván.
 * Các thay đổi trạng thái nên tạo ra một Game mới thay vì sửa đổi Game cũ.
 */
export class Game {
  /**
   * @param {object} options
   * @param {Board} options.board
   * @param {SideValue} [options.turn=Side.WHITE]
   * @param {Square | null} [options.enPassantTarget=null]
   * @param {string | null} [options.pendingPromotion=null]
   * @param {OutcomeResult | null} [options.result=null]
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

  /**
   * Trả về Game mới với các trường được cập nhật.
   * Không thay đổi Game hiện tại.
   *
   * @param {Partial<{
   *   board: Board,
   *   turn: SideValue,
   *   enPassantTarget: Square | null,
   *   pendingPromotion: string | null,
   *   result: OutcomeResult | null
   * }>} changes
   * @returns {Game}
   */
  with(changes) {
    return new Game({ ...this, ...changes });
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

  //Random
  /**
   * Tạo ván cờ ngẫu nhiên nhưng cân bằng cho hai bên:
   *  - Hai bên có CÙNG số quân, random trong [minPieces, BACK_RANK.length * 2].
   *  - Loại quân random, tổng điểm (PIECE_DEFS[type].value) hai bên chênh nhau <= tolerance.
   *  - Mỗi bên luôn có đúng 1 vua.
   *
   * @param {object} [options]
   * @param {number} [options.minPieces=4] Số quân tối thiểu mỗi bên (đã bao gồm vua).
   * @param {number} [options.tolerance=2] Chênh lệch điểm tối đa cho phép giữa hai bên.
   * @param {() => number} [options.rng=Math.random] Hàm random trả về số trong [0, 1); truyền RNG có seed để tái lập kết quả.
   * @returns {Game} Ván cờ mới với bàn cờ đã được xếp ngẫu nhiên.
   */
  static randomStandard({
    minPieces = 4,
    tolerance = 2,
    rng = Math.random,
  } = {}) {
    const maxPieces = BACK_RANK.length * 2;
    const minSize = Math.min(Math.max(minPieces, 2), maxPieces);

    const MAX_PER_TYPE = new Map([
      [PieceType.QUEEN, 2],
      [PieceType.ROOK, 3],
      [PieceType.BISHOP, 3],
      [PieceType.KNIGHT, 3],
      [PieceType.PAWN, STANDARD_COLS],
    ]);

    /**
     * Số nguyên ngẫu nhiên trong đoạn [min, max] (gồm cả hai đầu).
     * @param {number} min Giá trị nhỏ nhất.
     * @param {number} max Giá trị lớn nhất.
     * @returns {number}
     */
    const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1));

    /**
     * Xáo trộn mảng tại chỗ (Fisher-Yates) và trả về chính mảng đó.
     * @template T
     * @param {T[]} arr Mảng cần xáo trộn.
     * @returns {T[]}
     */
    const shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    /**
     * Tổng điểm của một đội quân, lấy từ PIECE_DEFS.
     * @param {(typeof PieceType)[keyof typeof PieceType][]} types Danh sách loại quân.
     * @returns {number}
     */
    const armyValue = (types) =>
      types.reduce((sum, t) => sum + PIECE_DEFS[t].value, 0);

    /**
     * Lấy ra một cột trống từ danh sách (đã xáo trộn); báo lỗi nếu hết chỗ.
     * @param {number[]} cols Danh sách cột còn trống (bị pop trực tiếp).
     * @returns {number}
     */
    const takeCol = (cols) => {
      const col = cols.pop();
      if (col === undefined) throw new Error("Không còn cột trống để đặt quân");
      return col;
    };

    /**
     * Tạo danh sách loại quân cho 1 bên: luôn có 1 vua + (size - 1) quân rút
     * ngẫu nhiên từ "túi" có giới hạn theo MAX_PER_TYPE.
     * @param {number} size Tổng số quân của bên này (đã gồm vua).
     * @returns {(typeof PieceType)[keyof typeof PieceType][]}
     */
    const randomArmy = (size) => {
      /** @type {(typeof PieceType)[keyof typeof PieceType][]} */
      const bag = [];
      for (const [type, max] of MAX_PER_TYPE) {
        for (let i = 0; i < max; i++) bag.push(type);
      }
      shuffle(bag);
      return [PieceType.KING, ...bag.slice(0, size - 1)];
    };

    /**
     * Tạo hai đội quân cùng số lượng và có tổng điểm chênh nhau <= tolerance.
     * Nếu thử 200 lần mà không đạt thì bên thứ hai dùng đúng thành phần quân của bên thứ nhất.
     * @param {number} size Số quân mỗi bên.
     * @returns {[(typeof PieceType)[keyof typeof PieceType][], (typeof PieceType)[keyof typeof PieceType][]]} [đội trắng, đội đen].
     */
    const balancedArmies = (size) => {
      const a = randomArmy(size);
      for (let i = 0; i < 200; i++) {
        const b = randomArmy(size);
        if (Math.abs(armyValue(a) - armyValue(b)) <= tolerance) return [a, b];
      }
      return [a, shuffle([...a])];
    };

    /**
     * Đặt quân của 1 bên vào hai hàng của mình:
     *  - Vua: luôn ở hàng sau.
     *  - Tốt: chỉ ở hàng trước.
     *  - Quân còn lại: ưu tiên hàng sau, hết chỗ mới xuống hàng trước.
     * @param {(typeof PieceType)[keyof typeof PieceType][]} types Danh sách loại quân của bên này.
     * @param {(typeof Side)[keyof typeof Side]} side Phe cần đặt quân.
     * @returns {Piece[]}
     */
    const placeArmy = (types, side) => {
      const backRow = side === Side.BLACK ? 0 : STANDARD_ROWS - 1;
      const frontRow = side === Side.BLACK ? 1 : STANDARD_ROWS - 2;
      const freeBack = shuffle([...Array(STANDARD_COLS).keys()]);
      const freeFront = shuffle([...Array(STANDARD_COLS).keys()]);

      /** @type {Piece[]} */
      const pieces = [];

      /**
       * Tạo một quân và thêm vào danh sách kết quả.
       * @param {(typeof PieceType)[keyof typeof PieceType]} type Loại quân.
       * @param {number} row Hàng đặt quân.
       * @param {number} col Cột đặt quân.
       * @returns {void}
       */
      const put = (type, row, col) => {
        pieces.push(new Piece({ type, side, row, col }));
      };

      put(PieceType.KING, backRow, takeCol(freeBack));

      for (const type of types) {
        if (type === PieceType.PAWN) put(type, frontRow, takeCol(freeFront));
      }

      const slots = [
        ...freeBack.map((col) => ({ row: backRow, col })),
        ...freeFront.map((col) => ({ row: frontRow, col })),
      ];
      for (const type of types) {
        if (type === PieceType.KING || type === PieceType.PAWN) continue;
        const slot = slots.shift();
        if (!slot) throw new Error("Không còn ô trống để đặt quân");
        put(type, slot.row, slot.col);
      }

      return pieces;
    };

    const size = randInt(minSize, maxPieces);
    const [whiteTypes, blackTypes] = balancedArmies(size);

    const pieces = [
      ...placeArmy(blackTypes, Side.BLACK),
      ...placeArmy(whiteTypes, Side.WHITE),
    ];
    return new Game({
      board: new Board(STANDARD_ROWS, STANDARD_COLS, pieces),
    });
  }
}
