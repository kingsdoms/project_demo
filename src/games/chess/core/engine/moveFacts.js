/**
 * @file moveFacts.js
 * @author tuanca
 */

// Tính các "sự thật" về thế cờ mà rule cần (move.inBoard, castle.pathEmpty, ...),
// rồi chạy rule để trả lời: nước nào hợp lệ, ván đã kết thúc chưa.
// Chỉ đọc, không đổi state. UI và bot import các hàm ở đây để lấy nước đi hợp lệ.
//
// Quy ước hàng: hàng 0 là phía đen, trắng đi về hàng 0 (xem PROMOTION_RANK).
// PIECE_MOVE_DEFS viết từ góc nhìn trắng, đọc cho đen thì đảo cả forward lẫn lateral.
//
// Ý nghĩa của steps trong PIECE_MOVE_DEFS:
//   Infinity: đi 1, 2, 3... ô cho tới khi gặp quân hoặc hết bàn
//   số hữu hạn N: đi đúng N ô, mọi ô ở giữa phải trống

import { GameError } from "../../utils/GameError.js";
import { ErrorCode } from "../constants/ErrorCode.js";
import { CaptureMode } from "../constants/CaptureMode.js";
import { MoveKind } from "../constants/MoveKind.js";
import { PieceType } from "../constants/PieceType.js";
import { OutcomeType } from "../constants/OutcomeType.js";

import { Side, SIDE_SIGN, OPPONENT } from "../constants/Side.js";
import { movesOf } from "../constants/PieceMoveDefs.js";
import { ruleSet, RULES_BY_KIND } from "./compose.js";
import { applyMove } from "./applyAction.js";

// // Bộ luật đã ghép. reduce dùng chung đúng bộ này.
// export const ruleSet = compose(boardRules, gameRules, pieceRules, outcomeRules);

// // Rule cần check cho từng loại nước đi, rẻ trước, đắt sau.
// // Rule ném lỗi ở rule đầu tiên sai, nên các sự thật phía sau không bao giờ bị tính trên nước vô nghĩa.
// const GATES = ["GAME_NOT_OVER", "PROMOTION_PENDING", "TURN"];
// export const RULES_BY_KIND = Object.freeze({
//   [MoveKind.NORMAL]: [
//     ...GATES,
//     "IN_BOARD",
//     "PATTERN",
//     "NOT_ALLY_TARGET",
//     "NOT_SELF_CHECK",
//   ],
//   [MoveKind.CASTLE]: [...GATES, "IN_BOARD", "CASTLE", "NOT_SELF_CHECK"],
//   [MoveKind.EN_PASSANT]: [...GATES, "IN_BOARD", "EN_PASSANT", "NOT_SELF_CHECK"],
// });
// export const PROMOTE_RULES = ["PROMOTE"];

// // Thứ tự thử kết quả ván. Trùng key với outcomeRules.
// const OUTCOME_KEYS = ["checkmate", "stalemate", "insufficientMaterial"];

// +1 cho trắng (đi về hàng nhỏ), -1 cho đen
// const sideSign = (side) => (side === Side.WHITE ? 1 : -1);
/////////////////////////////////ALL BEFORE HERE WILL BE DESTROY///////////////////////////////////////////////////

/**
 * @typedef {import("../models/Piece.js").Piece} Piece
 * @typedef {import("../models/Board.js").Board} Board
 * @typedef {import("../models/Game.js").Game} Game
 * @typedef {import("../models/Action.js").Action} Action
 *import { OutcomeDefs } from './../constants/OutcomeDefs';

 *
 *
 */

/** @type {{ unmoved: (piece: Piece) => boolean }} */
const REQUIRES = { unmoved: (piece) => !piece.hasMoved };

/**
 * Tạo một object có các thuộc tính được tính toán theo nhu cầu (lazy evaluation).
 *
 * Mỗi thuộc tính tương ứng với một factory function và chỉ được tính ở lần
 * truy cập đầu tiên; kết quả được lưu lại để tái sử dụng cho những lần sau.
 * Nhờ đó, các phép tính tốn kém như `exposesKing` chỉ chạy khi rule thực sự
 * cần đọc đến, tránh thực hiện những phép tính không cần thiết.
 *
 * @template {Record<string, () => unknown>} T
 * @param {T} factories - Object chứa các hàm tạo giá trị cho từng thuộc tính.
 * @returns {{ [K in keyof T]: ReturnType<T[K]> }} Object có các getter tính toán lười.
 */
function lazy(factories) {
  /** @type {{ [K in keyof T]: ReturnType<T[K]> }} */
  const out = /** @type {any} */ ({});
  for (const [key, fn] of Object.entries(factories)) {
    let done = false;
    /** @type {unknown} */
    let value;
    Object.defineProperty(out, key, {
      enumerable: true,
      get() {
        if (!done) {
          value = fn();
          done = true;
        }
        return value;
      },
    });
  }
  return out;
}

/**
 * Tính danh sách các ô liên quan đến hướng di chuyển của một quân cờ.
 *
 * Phân biệt hai chế độ:
 * - `forAttack = true`: trả về các ô quân cờ kiểm soát. Với tốt, chỉ tính
 *   hai ô chéo phía trước, kể cả khi các ô đó đang trống.
 * - `forAttack = false`: trả về các ô quân cờ có thể đi tới theo hình học
 *   và luật di chuyển của quân, kể cả ô đang có quân cùng bên. Việc loại
 *   mục tiêu đồng minh được xử lý riêng bởi rule `NOT_ALLY_TARGET`.
 *
 * Hàm chỉ xác định các ô ứng viên theo kiểu quân và trạng thái bàn cờ;
 * không tự quyết định toàn bộ tính hợp lệ của nước đi.
 *
 * @param {Board} board - Bàn cờ hiện tại.
 * @param {Piece} piece - Quân cờ cần xác định các ô đi tới hoặc kiểm soát.
 * @param {boolean} forAttack - `true` để lấy ô kiểm soát, `false` để lấy ô đi tới.
 * @returns {{ row: number, col: number }[]} Danh sách tọa độ các ô tương ứng.
 */
function patternSquares(board, piece, forAttack) {
  const s = SIDE_SIGN[piece.side];
  const squares = [];

  for (const m of movesOf(piece)) {
    // Attack but capture is never
    if (forAttack && m.capture === CaptureMode.NEVER) continue;
    // When contain requires
    if (m.requires !== undefined) {
      const met = REQUIRES[/** @type {keyof typeof REQUIRES} */ (m.requires)];
      if (met === undefined)
        throw new GameError(
          ErrorCode.INVALID_ARGUMENT,
          `Điều kiện "${m.requires}" chưa được khai báo`,
        );
      if (!met(piece)) continue;
    }

    const ray = board.ray(
      piece.row,
      piece.col,
      -s * m.forward,
      s * m.lateral,
      m.steps,
    );
    // ray dừng ngay sau ô có quân đầu tiên, nên ray.length === steps nghĩa là các ô giữa đều trống
    const reached =
      m.steps === Infinity
        ? ray
        : ray.length === m.steps
          ? [ray[ray.length - 1]]
          : [];

    for (const sq of reached) {
      const occupied = sq.occupant !== null;
      const ok =
        forAttack ||
        m.capture === CaptureMode.ANY ||
        (m.capture === CaptureMode.NEVER && !occupied) ||
        (m.capture === CaptureMode.ONLY && occupied);
      if (ok) squares.push(sq);
    }
  }
  return squares;
}

/**
 * Lấy các ô mà quân cờ có thể di chuyển tới theo quy tắc hình học.
 *
 * @param {Board} board - Bàn cờ hiện tại.
 * @param {Piece} piece - Quân cờ cần kiểm tra.
 * @returns {{ row: number, col: number }[]} Danh sách tọa độ các ô có thể đi tới.
 */
export const movementSquares = (board, piece) =>
  patternSquares(board, piece, false);

/**
 * Lấy các ô mà quân cờ đang kiểm soát hoặc tấn công.
 *
 * Với quân tốt, các ô chéo phía trước vẫn được tính kể cả khi đang trống.
 *
 * @param {Board} board - Bàn cờ hiện tại.
 * @param {Piece} piece - Quân cờ cần kiểm tra.
 * @returns {{ row: number, col: number }[]} Danh sách tọa độ các ô bị kiểm soát.
 */
export const attackSquares = (board, piece) =>
  patternSquares(board, piece, true);

/**
 * Kiểm tra danh sách tọa độ có chứa ô được chỉ định hay không.
 *
 * @param {{ row: number, col: number }[]} squares - Danh sách tọa độ các ô.
 * @param {number} row - Hàng cần kiểm tra.
 * @param {number} col - Cột cần kiểm tra.
 * @returns {boolean} `true` nếu tìm thấy ô tương ứng, ngược lại là `false`.
 */
const hasSquare = (squares, row, col) =>
  squares.some((sq) => sq.row === row && sq.col === col);

/**
 * Kiểm tra một ô có bị ít nhất một quân của bên chỉ định tấn công hay không.
 *
 * Dựa trên danh sách ô tấn công của từng quân, không phụ thuộc vào việc
 * ô đích hiện có quân hay đang trống.
 *
 * @param {Board} board - Bàn cờ hiện tại.
 * @param {number} row - Hàng của ô cần kiểm tra.
 * @param {number} col - Cột của ô cần kiểm tra.
 * @param {typeof Side[keyof typeof Side]} bySide - Bên có quân đang xét tấn công.
 * @returns {boolean} `true` nếu ô bị tấn công, ngược lại là `false`.
 */
export function isAttacked(board, row, col, bySide) {
  return board.pieces.some(
    (p) => p.side === bySide && hasSquare(attackSquares(board, p), row, col),
  );
}

/**
 * Tìm quân vua của một bên trên bàn cờ.
 *
 * @param {Board} board - Bàn cờ cần tìm.
 * @param {typeof Side[keyof typeof Side]} side - Bên sở hữu quân vua.
 * @returns {Piece | null} Quân vua nếu tìm thấy, hoặc `null` nếu không có.
 */
export function findKing(board, side) {
  return (
    board.pieces.find((p) => p.type === PieceType.KING && p.side === side) ??
    null
  );
}

/**
 * Kiểm tra vua của một bên có đang bị chiếu hay không.
 *
 * Nếu bàn cờ không có vua của bên đó (chẳng hạn bàn cờ thử nghiệm),
 * hàm xem như vua không bị chiếu.
 *
 * @param {Board} board - Bàn cờ hiện tại.
 * @param {typeof Side[keyof typeof Side]} side - Bên cần kiểm tra.
 * @returns {boolean} `true` nếu vua đang bị chiếu, ngược lại là `false`.
 */
export function isInCheck(board, side) {
  const king = findKing(board, side);
  return king !== null && isAttacked(board, king.row, king.col, OPPONENT[side]);
}
/**
 * Kiểm tra bàn cờ có rơi vào trường hợp không đủ quân để chiếu hết hay không.
 *
 * Các trường hợp được xem là không đủ quân:
 * - Chỉ còn hai vua.
 * - Hai vua và chỉ có thêm một tượng hoặc một mã.
 * - Hai vua và các tượng còn lại đều đứng trên cùng màu ô.
 *
 * @param {Board} board - Bàn cờ cần kiểm tra.
 * @returns {boolean} `true` nếu không đủ quân để chiếu hết, ngược lại là `false`.
 */
function hasInsufficientMaterial(board) {
  const others = board.pieces.filter((p) => p.type !== PieceType.KING);
  if (others.length === 0) return true;
  if (others.length === 1)
    return (
      others[0].type === PieceType.BISHOP || others[0].type === PieceType.KNIGHT
    );
  if (others.every((p) => p.type === PieceType.BISHOP)) {
    const color = (others[0].row + others[0].col) % 2;
    return others.every((p) => (p.row + p.col) % 2 === color);
  }
  return false;
}

// ---------- Phân loại nước đi và dựng input cho rule ----------

/**
 * Phân loại nước đi dựa trên hình dạng và trạng thái hiện tại của game,
 * chưa kiểm tra nước đi có hợp lệ theo luật hay không.
 * Vua di chuyển ngang 2 ô được phân loại là nhập thành.
 * Tốt di chuyển chéo vào ô `enPassantTarget` đang trống được phân loại
 * là bắt tốt qua đường.
 *
 * @param {Game} game - Trạng thái game hiện tại.
 * @param {Piece} piece - Quân cờ thực hiện nước đi.
 * @param {number} row - Hàng đích.
 * @param {number} col - Cột đích.
 * @returns {typeof MoveKind[keyof typeof MoveKind]} Loại nước đi được phân loại.
 */
export function classifyMove(game, piece, row, col) {
  if (
    piece.type === PieceType.KING &&
    row === piece.row &&
    Math.abs(col - piece.col) === 2
  )
    return MoveKind.CASTLE;

  const ep = game.enPassantTarget;
  if (
    piece.type === PieceType.PAWN &&
    ep !== null &&
    row === ep.row &&
    col === ep.col &&
    row === piece.row - SIDE_SIGN[piece.side] &&
    Math.abs(col - piece.col) === 1 &&
    game.board.pieceAt(row, col) === null
  )
    return MoveKind.EN_PASSANT;

  return MoveKind.NORMAL;
}

/**
 * Tính các điều kiện cần thiết để xác định nước nhập thành có hợp lệ hay không.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} king - Quân vua thực hiện nhập thành.
 * @param {number} col - Cột đích mà vua muốn di chuyển tới.
 * @returns {object} Các thông tin phục vụ việc kiểm tra điều kiện nhập thành.
 */
function castleFacts(game, king, col) {
  const board = game.board;
  const dir = Math.sign(col - king.col);
  const rookCol = dir > 0 ? board.cols - 1 : 0;
  const found = board.pieceAt(king.row, rookCol);
  const rook =
    found !== null && found.type === PieceType.ROOK && found.side === king.side
      ? found
      : null;
  const enemy = OPPONENT[king.side];

  return {
    // Không có xe ở góc thì coi như xe đã đi, nhập thành bị từ chối
    rook: rook ?? { hasMoved: true },
    castle: lazy({
      pathEmpty: () => {
        const lo = Math.min(king.col, rookCol);
        const hi = Math.max(king.col, rookCol);
        for (let c = lo + 1; c < hi; c++) {
          if (board.pieceAt(king.row, c) !== null) return false;
        }
        return rook !== null;
      },
      inCheck: () => isAttacked(board, king.row, king.col, enemy),
      // Ô vua đi qua và ô vua tới
      passesAttacked: () =>
        [1, 2].some((i) =>
          isAttacked(board, king.row, king.col + dir * i, enemy),
        ),
    }),
  };
}

/**
 * Tính các thông tin cần thiết để kiểm tra nước bắt tốt qua đường (en passant).
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} pawn - Quân tốt đang thực hiện nước bắt qua đường.
 * @param {number} row - Hàng đích của nước đi.
 * @param {number} col - Cột đích của nước đi.
 * @returns {object} Các thông tin phục vụ việc kiểm tra điều kiện bắt tốt qua đường.
 */
function passantFacts(game, pawn, row, col) {
  const ep = game.enPassantTarget;
  return {
    passant: lazy({
      targetMatches: () => ep !== null && ep.row === row && ep.col === col,
      // enPassantTarget chỉ tồn tại ngay sau một nước đi 2 ô, nên tốt đối phương đứng cạnh là tốt vừa đi
      capturedPawnJustDoubled: () => {
        const victim = game.board.pieceAt(pawn.row, col);
        return (
          ep !== null &&
          victim !== null &&
          victim.type === PieceType.PAWN &&
          victim.side !== pawn.side &&
          victim.col === ep.col
        );
      },
    }),
  };
}

/**
 * Xây dựng dữ liệu đầu vào cho các rule kiểm tra một nước đi.
 *
 * Tạo object chứa trạng thái ván cờ, quân cờ, tọa độ đích, loại nước đi
 * và các sự thật cần thiết để đánh giá tính hợp lệ của nước đi.
 * Các sự thật được tính lười (lazy evaluation): chỉ tính khi rule truy cập
 * và lưu kết quả để tái sử dụng, tránh lặp lại các phép tính tốn kém.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ thực hiện nước đi.
 * @param {number} row - Hàng đích.
 * @param {number} col - Cột đích.
 * @param {typeof MoveKind[keyof typeof MoveKind]} kind - Loại nước đi.
 * @returns {Record<string, unknown>} Dữ liệu đầu vào cho các rule.
 */
export function buildMoveInput(game, piece, row, col, kind) {
  const board = game.board;
  const input = {
    piece,
    turn: game.turn,
    state: { result: game.result },
    move: lazy({
      inBoard: () => board.inBounds(row, col),
      reachable: () =>
        board.inBounds(row, col) &&
        hasSquare(movementSquares(board, piece), row, col),
      targetIsAlly: () => board.pieceAt(row, col)?.side === piece.side,
      // Thử đi nước đó trên bàn mới rồi xem vua mình có bị tấn công không
      exposesKing: () =>
        isInCheck(applyMove(game, piece, row, col, kind).board, piece.side),
      blockedByPromotion: () => game.pendingPromotion !== null,
    }),
  };
  if (kind === MoveKind.CASTLE)
    Object.assign(input, castleFacts(game, piece, col));
  if (kind === MoveKind.EN_PASSANT)
    Object.assign(input, passantFacts(game, piece, row, col));
  return input;
}

/**
 * Xây dựng dữ liệu đầu vào cho rule kiểm tra phong cấp quân.
 *
 * Kết hợp trạng thái ván cờ, quân tốt cần phong cấp và hành động được yêu cầu
 * để rule `PROMOTE` xác định hành động phong cấp có hợp lệ hay không.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân tốt đang chờ phong cấp.
 * @param {Action} action - Hành động yêu cầu phong cấp.
 * @returns {Record<string, unknown>} Dữ liệu đầu vào cho rule `PROMOTE`.
 */
export function buildPromoteInput(game, piece, action) {
  return {
    piece,
    turn: game.turn,
    state: { result: game.result },
    pendingPromotion: game.pendingPromotion,
    newPieceType: action.pieceType,
    action: { id: action.id, pieceType: action.pieceType },
  };
}

// ---------- Nước đi hợp lệ ----------
/**
 * Kiểm tra tất cả rule được chỉ định đều đạt yêu cầu với dữ liệu đầu vào.
 *
 * Dừng ngay khi có rule không đạt. Nếu một key không tồn tại trong `ruleSet`,
 * việc gọi `test()` sẽ gây lỗi; cần bảo đảm các rule đã được đăng ký đầy đủ.
 *
 * @param {string[]} keys - Danh sách key của các rule cần kiểm tra.
 * @param {Record<string, unknown>} input - Dữ liệu đầu vào cho các rule.
 * @returns {boolean} `true` nếu tất cả rule đều đạt, ngược lại là `false`.
 */
const passes = (keys, input) =>
  keys.every((key) => ruleSet.get(key).test(input));

/**
 * Tạo danh sách các ô đích ứng viên cho một quân cờ.
 *
 * Bao gồm các ô đi theo quy tắc di chuyển thông thường, các ô đích nhập
 * thành của vua và ô đích bắt tốt qua đường của tốt khi có thể áp dụng.
 * Đây chỉ là tập hợp ứng viên; tính hợp lệ thực tế của từng nước đi
 * được xác định bởi hệ thống rule.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ cần tìm các ô đích ứng viên.
 * @returns {{ row: number, col: number }[]} Danh sách tọa độ các ô đích ứng viên.
 */
function candidateSquares(game, piece) {
  const board = game.board;
  const seen = new Set();
  /** @type {{ row: number, col: number }[]} */
  const out = [];
  /**
   * Thêm ô vào danh sách nếu ô nằm trong bàn và chưa được thêm.
   *
   * @param {number} row
   * @param {number} col
   * @returns {void}
   */
  const add = (row, col) => {
    const key = `${row},${col}`;
    if (seen.has(key) || !board.inBounds(row, col)) return;
    seen.add(key);
    out.push({ row, col });
  };

  for (const sq of movementSquares(board, piece)) add(sq.row, sq.col);
  if (piece.type === PieceType.KING) {
    add(piece.row, piece.col - 2);
    add(piece.row, piece.col + 2);
  }
  if (piece.type === PieceType.PAWN && game.enPassantTarget !== null)
    add(game.enPassantTarget.row, game.enPassantTarget.col);
  return out;
}

/**
 * Sinh lần lượt các nước đi hợp lệ của một quân cờ trong trạng thái game hiện tại.
 *
 * Duyệt các ô đích ứng viên, phân loại từng nước đi và dùng hệ thống rule
 * để kiểm tra tính hợp lệ. Dùng generator để mỗi nước đi được trả về khi
 * cần, thay vì tạo toàn bộ danh sách cùng lúc.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ cần tìm nước đi hợp lệ.
 * @yields {Action} Mỗi hành động di chuyển hợp lệ của quân cờ.
 */
function* legalMoves(game, piece) {
  for (const { row, col } of candidateSquares(game, piece)) {
    const kind = classifyMove(game, piece, row, col);
    if (
      passes(RULES_BY_KIND[kind], buildMoveInput(game, piece, row, col, kind))
    )
      yield { row, col, kind };
  }
}
/**
 * Lấy danh sách các nước đi hợp lệ của một quân cờ.
 *
 * Trả về danh sách rỗng nếu không đến lượt bên sở hữu quân cờ,
 * ván đấu đã kết thúc hoặc game đang chờ phong cấp.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ cần lấy các nước đi hợp lệ.
 * @returns {{ row: number, col: number, kind: typeof MoveKind[keyof typeof MoveKind] }[]}
 * Danh sách nước đi hợp lệ, mỗi phần tử gồm tọa độ đích và loại nước đi.
 */
export function getLegalMoves(game, piece) {
  return [...legalMoves(game, piece)];
}
/**
 * Lấy toàn bộ nước đi hợp lệ của bên đang tới lượt.
 *
 * Duyệt các quân thuộc bên đang tới lượt và tổng hợp những nước đi
 * hợp lệ của từng quân. Mỗi nước đi bao gồm ID quân cờ, tọa độ đích
 * và loại nước đi.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @returns {{ id: string, row: number, col: number, kind: typeof MoveKind[keyof typeof MoveKind] }[]}
 * Danh sách toàn bộ nước đi hợp lệ của bên đang tới lượt.
 */
export function getAllLegalMoves(game) {
  return game.board.pieces
    .filter((p) => p.side === game.turn)
    .flatMap((p) => getLegalMoves(game, p).map((m) => ({ id: p.id, ...m })));
}
/**
 * Kiểm tra bên đang tới lượt có còn nước đi hợp lệ hay không.
 *
 * Dừng ngay khi tìm thấy nước đi hợp lệ đầu tiên, không cần duyệt hết
 * các nước đi có thể có.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @returns {boolean} `true` nếu còn ít nhất một nước đi hợp lệ, ngược lại là `false`.
 */
export function hasLegalMove(game) {
  for (const piece of game.board.pieces) {
    if (piece.side !== game.turn) continue;
    if (!legalMoves(game, piece).next().done) return true;
  }
  return false;
}

// ---------- Kết quả ván ----------
/**
 * Đánh giá trạng thái kết thúc của ván cờ hiện tại.
 *
 * Chỉ gọi khi `game.result` còn là `null`, vì `hasLegalMove()` sử dụng
 * rule `GAME_NOT_OVER` để kiểm tra nước đi hợp lệ.
 *
 * Xác định các trường hợp:
 * - `checkmate`: bên đang tới lượt bị chiếu hết.
 * - `stalemate`: bên đang tới lượt không còn nước hợp lệ nhưng không bị chiếu.
 * - `insufficientMaterial`: không đủ quân để chiếu hết.
 *
 * Trả về `null` nếu ván đấu vẫn có thể tiếp tục.
 *
 * @param {Game} game - Trạng thái ván cờ cần đánh giá.
 * @returns {{ type: typeof OutcomeType[keyof typeof OutcomeType], winner: typeof Side[keyof typeof Side] | null } | null}
 * Kết quả ván đấu nếu đã kết thúc, hoặc `null` nếu ván vẫn tiếp tục.
 */
export function evaluateOutcome(game) {
  const side = game.turn;
  const facts = {
    position: lazy({
      inCheck: () => isInCheck(game.board, side),
      hasLegalMove: () => hasLegalMove(game),
      insufficientMaterial: () => hasInsufficientMaterial(game.board),
    }),
  };

  for (const key of Object.values(OutcomeType)) {
    const rule = ruleSet.get(key);
    if (!rule) throw new Error(`Rule "${key}" chưa được đăng ký`);

    if (rule.test(facts)) {
      return Object.freeze({
        type: key,
        winner: key === OutcomeType.CHECKMATE ? OPPONENT[side] : null,
      });
    }
  }
  return null;
}
