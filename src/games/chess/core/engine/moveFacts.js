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
import { Side } from "../constants/Side.js";
import { movesOf } from "../constants/PieceMoveDefs.js";
import { boardRules } from "../rules/boardRules.js";
import { gameRules } from "../rules/gameRules.js";
import { outcomeRules } from "../rules/outcomeRules.js";
import { pieceRules } from "../rules/pieceRules.js";
import { compose } from "./compose.js";
import { applyMove, opponent } from "./applyMove.js";

// Bộ luật đã ghép. reduce dùng chung đúng bộ này.
export const ruleSet = compose(boardRules, gameRules, pieceRules, outcomeRules);

// Rule cần check cho từng loại nước đi, rẻ trước, đắt sau.
// Rule ném lỗi ở rule đầu tiên sai, nên các sự thật phía sau không bao giờ bị tính trên nước vô nghĩa.
const GATES = ["GAME_NOT_OVER", "PROMOTION_PENDING", "TURN"];
export const RULES_BY_KIND = Object.freeze({
  [MoveKind.NORMAL]: [...GATES, "IN_BOARD", "PATTERN", "NOT_ALLY_TARGET", "NOT_SELF_CHECK"],
  [MoveKind.CASTLE]: [...GATES, "IN_BOARD", "CASTLE", "NOT_SELF_CHECK"],
  [MoveKind.EN_PASSANT]: [...GATES, "IN_BOARD", "EN_PASSANT", "NOT_SELF_CHECK"],
});
export const PROMOTE_RULES = ["PROMOTE"];

// Thứ tự thử kết quả ván. Trùng key với outcomeRules.
const OUTCOME_KEYS = ["checkmate", "stalemate", "insufficientMaterial"];

const REQUIRES = { unmoved: (piece) => !piece.hasMoved };

// +1 cho trắng (đi về hàng nhỏ), -1 cho đen
const sideSign = (side) => (side === Side.WHITE ? 1 : -1);

// Gói các hàm tính sự thật thành object có getter, mỗi sự thật chỉ tính khi rule đọc tới
// và chỉ tính một lần. Nhờ vậy sự thật tốn kém (exposesKing) không bị tính trên nước đã bị rule rẻ loại.
function lazy(factories) {
  const out = {};
  for (const [key, fn] of Object.entries(factories)) {
    let done = false;
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

// ---------- Hình học: ô quân đi tới và ô quân tấn công ----------

// forAttack = true: ô quân kiểm soát (tốt chỉ tính hai đường chéo, ô trống vẫn tính).
// forAttack = false: ô quân đi tới được theo luật đi quân, kể cả ô có quân cùng bên
// (NOT_ALLY_TARGET sẽ loại ô đó, để báo đúng lý do).
function patternSquares(board, piece, forAttack) {
  const s = sideSign(piece.side);
  const squares = [];

  for (const m of movesOf(piece)) {
    if (forAttack && m.capture === CaptureMode.NEVER) continue;
    if (m.requires !== undefined) {
      const met = REQUIRES[m.requires];
      if (met === undefined)
        throw new GameError(ErrorCode.BAD_ACTION, `Điều kiện "${m.requires}" chưa được hỗ trợ`);
      if (!met(piece)) continue;
    }

    const ray = board.ray(piece.row, piece.col, -s * m.forward, s * m.lateral, m.steps);
    // ray dừng ngay sau ô có quân đầu tiên, nên ray.length === steps nghĩa là các ô giữa đều trống
    const reached =
      m.steps === Infinity ? ray : ray.length === m.steps ? [ray[ray.length - 1]] : [];

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

export const movementSquares = (board, piece) => patternSquares(board, piece, false);
export const attackSquares = (board, piece) => patternSquares(board, piece, true);

const hasSquare = (squares, row, col) => squares.some((sq) => sq.row === row && sq.col === col);

// Ô (row, col) có bị quân của bySide tấn công không
export function isAttacked(board, row, col, bySide) {
  return board.pieces.some(
    (p) => p.side === bySide && hasSquare(attackSquares(board, p), row, col),
  );
}

export function findKing(board, side) {
  return board.pieces.find((p) => p.type === PieceType.KING && p.side === side) ?? null;
}

// Vua của side có đang bị chiếu không. Không có vua (bàn thử nghiệm) thì coi là không bị chiếu.
export function isInCheck(board, side) {
  const king = findKing(board, side);
  return king !== null && isAttacked(board, king.row, king.col, opponent(side));
}

// Không bên nào còn đủ quân để chiếu hết:
// chỉ còn hai vua, hoặc thêm đúng một tượng hoặc một mã, hoặc chỉ còn các tượng cùng màu ô.
function hasInsufficientMaterial(board) {
  const others = board.pieces.filter((p) => p.type !== PieceType.KING);
  if (others.length === 0) return true;
  if (others.length === 1)
    return others[0].type === PieceType.BISHOP || others[0].type === PieceType.KNIGHT;
  if (others.every((p) => p.type === PieceType.BISHOP)) {
    const color = (others[0].row + others[0].col) % 2;
    return others.every((p) => (p.row + p.col) % 2 === color);
  }
  return false;
}

// ---------- Phân loại nước đi và dựng input cho rule ----------

// Phân loại theo hình dạng nước đi, chưa xét hợp lệ.
// Vua đi 2 ô ngang là nhập thành. Tốt đi chéo vào ô enPassantTarget còn trống là bắt qua đường.
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
    row === piece.row - sideSign(piece.side) &&
    Math.abs(col - piece.col) === 1 &&
    game.board.pieceAt(row, col) === null
  )
    return MoveKind.EN_PASSANT;

  return MoveKind.NORMAL;
}

function castleFacts(game, king, col) {
  const board = game.board;
  const dir = Math.sign(col - king.col);
  const rookCol = dir > 0 ? board.cols - 1 : 0;
  const found = board.pieceAt(king.row, rookCol);
  const rook =
    found !== null && found.type === PieceType.ROOK && found.side === king.side ? found : null;
  const enemy = opponent(king.side);

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
        [1, 2].some((i) => isAttacked(board, king.row, king.col + dir * i, enemy)),
    }),
  };
}

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

// Input cho các rule của một nước đi MOVE. Mọi sự thật đều tính lười.
export function buildMoveInput(game, piece, row, col, kind) {
  const board = game.board;
  const input = {
    piece,
    turn: game.turn,
    state: { result: game.result },
    move: lazy({
      inBoard: () => board.inBounds(row, col),
      reachable: () =>
        board.inBounds(row, col) && hasSquare(movementSquares(board, piece), row, col),
      targetIsAlly: () => board.pieceAt(row, col)?.side === piece.side,
      // Thử đi nước đó trên bàn mới rồi xem vua mình có bị tấn công không
      exposesKing: () => isInCheck(applyMove(game, piece, row, col, kind).board, piece.side),
      blockedByPromotion: () => game.pendingPromotion !== null,
    }),
  };
  if (kind === MoveKind.CASTLE) Object.assign(input, castleFacts(game, piece, col));
  if (kind === MoveKind.EN_PASSANT) Object.assign(input, passantFacts(game, piece, row, col));
  return input;
}

// Input cho rule PROMOTE
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

const passes = (keys, input) => keys.every((key) => ruleSet.get(key).test(input));

// Các ô có thể là đích: ô theo luật đi quân, hai ô nhập thành của vua, ô bắt qua đường của tốt.
// Đây chỉ là tập ứng viên, hợp lệ hay không do rule quyết định.
function candidateSquares(game, piece) {
  const board = game.board;
  const seen = new Set();
  const out = [];
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

function* legalMoves(game, piece) {
  for (const { row, col } of candidateSquares(game, piece)) {
    const kind = classifyMove(game, piece, row, col);
    if (passes(RULES_BY_KIND[kind], buildMoveInput(game, piece, row, col, kind)))
      yield { row, col, kind };
  }
}

// Nước đi hợp lệ của một quân: [{ row, col, kind }].
// Rỗng nếu không tới lượt quân đó, đang chờ phong cấp, hoặc ván đã kết thúc.
export function getLegalMoves(game, piece) {
  return [...legalMoves(game, piece)];
}

// Toàn bộ nước đi hợp lệ của bên đang tới lượt: [{ id, row, col, kind }]
export function getAllLegalMoves(game) {
  return game.board.pieces
    .filter((p) => p.side === game.turn)
    .flatMap((p) => getLegalMoves(game, p).map((m) => ({ id: p.id, ...m })));
}

// Bên đang tới lượt còn nước hợp lệ nào không. Dừng ngay khi tìm thấy một nước.
export function hasLegalMove(game) {
  for (const piece of game.board.pieces) {
    if (piece.side !== game.turn) continue;
    if (!legalMoves(game, piece).next().done) return true;
  }
  return false;
}

// ---------- Kết quả ván ----------

// Trả về { type, winner } hoặc null nếu ván còn tiếp tục.
// type là một trong "checkmate", "stalemate", "insufficientMaterial".
// Phải gọi khi game.result còn null, vì hasLegalMove dùng rule GAME_NOT_OVER.
export function evaluateOutcome(game) {
  const side = game.turn;
  const facts = {
    position: lazy({
      inCheck: () => isInCheck(game.board, side),
      hasLegalMove: () => hasLegalMove(game),
      insufficientMaterial: () => hasInsufficientMaterial(game.board),
    }),
  };

  for (const key of OUTCOME_KEYS) {
    if (ruleSet.get(key).test(facts)) {
      return Object.freeze({
        type: key,
        winner: key === "checkmate" ? opponent(side) : null,
      });
    }
  }
  return null;
}