/**
 * @file applyAction.js
 * @author tuanca
 */
import { GameError } from "../../utils/GameError.js";
import { ErrorCode } from "../constants/ErrorCode.js";
import { MoveKind } from "../constants/MoveKind.js";
import { PieceType } from "../constants/PieceType.js";
import { Side, OPPONENT } from "../constants/Side.js";
import { PROMOTION_RANK } from "../constants/StandardDef.js";

/**
 * @typedef {import("../models/Game.js").Game} Game
 * @typedef {import("../models/Piece.js").Piece} Piece
 * @typedef {import("../models/Board.js").Board} Board
 *
 */

/**
 * Áp dụng một nước đi lên game và trả về trạng thái game mới.
 * Nhận tọa độ đích thay vì Action để `moveFacts` có thể thử nước đi
 * mà không cần tạo Action cho từng ô.
 *
 * Với nhập thành, `(row, col)` là ô đích của vua.
 * Với bắt tốt qua đường, `(row, col)` là ô đích của tốt,
 * chính là `enPassantTarget`.
 *
 * @param {Game} game - Trạng thái game hiện tại.
 * @param {Piece} piece - Quân cờ thực hiện nước đi.
 * @param {number} row - Hàng của ô đích.
 * @param {number} col - Cột của ô đích.
 * @param {typeof MoveKind[keyof typeof MoveKind]} [kind=MoveKind.NORMAL] - Loại nước đi cần áp dụng.
 * @returns {Game} Trạng thái game sau khi áp dụng nước đi.
 */
export function applyMove(game, piece, row, col, kind = MoveKind.NORMAL) {
  switch (kind) {
    case MoveKind.NORMAL:
      return applyNormal(game, piece, row, col);
    case MoveKind.CASTLE:
      return applyCastle(game, piece, row, col);
    case MoveKind.EN_PASSANT:
      return applyEnPassant(game, piece, row, col);
    default:
      throw new GameError(
        ErrorCode.BAD_ACTION,
        `Loại nước đi không hợp lệ: ${kind}`,
      );
  }
}

/**
 * Hoàn tất phong cấp cho tốt đang chờ trong `game.pendingPromotion`.
 * Không kiểm tra ID có khớp action hay quân được chọn có hợp lệ hay không;
 * các điều kiện này do rule `PROMOTE` đảm nhiệm.
 *
 * @param {Game} game - Trạng thái game hiện tại.
 * @param {Piece} piece
 * @param {typeof PieceType[keyof typeof PieceType]} pieceType - Loại quân được chọn để phong cấp.
 * @returns {Game} Trạng thái game sau khi hoàn tất phong cấp.
 */
export function applyPromotion(game, piece, pieceType) {
  const promoted = piece.with({ type: pieceType });
  const board = game.board.remove(piece.id).add(promoted);

  return game.with({
    board,
    pendingPromotion: null,
    turn: OPPONENT[piece.side],
  });
}

/**
 * Áp dụng nước đi thông thường (di chuyển hoặc bắt quân) và trả về game mới.
 *
 * @param {Game} game
 * @param {Piece} piece
 * @param {number} row
 * @param {number} col
 * @returns {Game}
 */
function applyNormal(game, piece, row, col) {
  let board = game.board;

  // Ăn quân: bỏ quân ở ô đích trước khi đặt quân mới vào
  const target = board.pieceAt(row, col);
  if (target !== null) board = board.remove(target.id);

  const moved = piece.with({ row, col, hasMoved: true });
  board = board.remove(piece.id).add(moved);

  const isPawn = piece.type === PieceType.PAWN;
  const doubleStep = isPawn && Math.abs(row - piece.row) === 2;
  const promotes = isPawn && row === PROMOTION_RANK[piece.side];

  return finish(
    game,
    board,
    piece.side,
    // Ô bị bỏ qua nằm giữa ô xuất phát và ô đích
    doubleStep ? { row: (piece.row + row) / 2, col } : null,
    promotes ? moved.id : null,
  );
}

/**
 * Áp dụng nước nhập thành: di chuyển vua đến ô đích và xe đến ô
 * vua vừa đi qua, sau đó trả về trạng thái game mới.
 *
 * Nhập thành gần: vua cột 4 → 6, xe cột 7 → 5.
 * Nhập thành xa: vua cột 4 → 2, xe cột 0 → 3.
 *
 * @param {Game} game
 * @param {Piece} king
 * @param {number} row
 * @param {number} col
 * @returns {Game}
 */
function applyCastle(game, king, row, col) {
  if (king.type !== PieceType.KING)
    throw new GameError(ErrorCode.BAD_ACTION, "Chỉ vua mới nhập thành");
  if (row !== king.row || Math.abs(col - king.col) !== 2)
    throw new GameError(
      ErrorCode.BAD_ACTION,
      "Nhập thành: vua phải đi đúng 2 ô theo hàng ngang",
    );

  const board = game.board;
  const dir = Math.sign(col - king.col);
  const rookCol = dir > 0 ? board.cols - 1 : 0;

  const rook = board.pieceAt(king.row, rookCol);
  if (rook === null || rook.type !== PieceType.ROOK || rook.side !== king.side)
    throw new GameError(ErrorCode.BAD_ACTION, "Không có xe để nhập thành");

  const kingMoved = king.with({ col, hasMoved: true });
  const rookMoved = rook.with({ col: king.col + dir, hasMoved: true });

  const next = board
    .remove(king.id)
    .remove(rook.id)
    .add(kingMoved)
    .add(rookMoved);

  return finish(game, next, king.side, null, null);
}

/**
 * Áp dụng nước bắt tốt qua đường (en passant) và trả về game mới.
 * Tốt bắt đi chéo vào ô trống; tốt đối phương ở ô cùng hàng với
 * tốt bắt và cùng cột với ô xuất phát của tốt bắt sẽ bị loại khỏi bàn.
 *
 * @param {Game} game
 * @param {Piece} pawn
 * @param {number} row
 * @param {number} col
 * @returns {Game}
 */
function applyEnPassant(game, pawn, row, col) {
  if (pawn.type !== PieceType.PAWN)
    throw new GameError(ErrorCode.BAD_ACTION, "Chỉ tốt mới bắt qua đường");

  const victim = game.board.pieceAt(pawn.row, col);
  if (
    victim === null ||
    victim.type !== PieceType.PAWN ||
    victim.side === pawn.side
  )
    throw new GameError(
      ErrorCode.BAD_ACTION,
      "Không có tốt đối phương để bắt qua đường",
    );

  const moved = pawn.with({ row, col, hasMoved: true });
  const board = game.board.remove(victim.id).remove(pawn.id).add(moved);

  return finish(game, board, pawn.side, null, null);
}

/**
 * Hoàn tất nước đi bằng cách cập nhật các trạng thái chung của game.
 * Chưa đổi lượt nếu game đang chờ phong cấp.
 *
 * @param {Game} game
 * @param {Board} board
 * @param {typeof Side[keyof typeof Side]} side
 * @param {{ row: number, col: number } | null} enPassantTarget
 * @param {string | null} pendingPromotion
 * @returns {Game}
 */
function finish(game, board, side, enPassantTarget, pendingPromotion) {
  const next = game.with({
    board,
    enPassantTarget,
    pendingPromotion,
  });

  return pendingPromotion === null ? next.with({ turn: OPPONENT[side] }) : next;
}
