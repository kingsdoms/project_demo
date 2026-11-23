/**
 * @file history.js
 * Suy ra lịch sử nước đi bằng cách so sánh hai trạng thái Game liên tiếp.
 *
 * Id của Piece được tính từ `type-side-row-col`, nên id đổi mỗi khi quân di chuyển.
 * Vì vậy ta so sánh theo id (tức theo ô) thay vì theo danh tính quân.
 */

import { MoveKind } from "../core/constants/MoveKind.js";
import { PieceType } from "../core/constants/PieceType.js";

/** @typedef {import("../core/models/Game.js").Game} Game */
/** @typedef {import("./toview.js").HistoryEntry} HistoryEntry */

/** @type {readonly HistoryEntry[]} */
export const EMPTY_HISTORY = Object.freeze([]);

const position = (piece) => Object.freeze({ row: piece.row, col: piece.col });

/** Ván mới: chưa quân nào di chuyển, trắng đi trước, không chờ phong cấp. */
function isFreshGame(game) {
  return (
    game.pendingPromotion == null &&
    game.result == null &&
    game.board.pieces.every((piece) => !piece.hasMoved)
  );
}

/**
 * @param {Game} prev
 * @param {Game} next
 * @param {readonly HistoryEntry[]} history
 * @returns {readonly HistoryEntry[]}
 */
export function updateHistory(prev, next, history) {
  if (isFreshGame(next)) return EMPTY_HISTORY;

  const prevIds = new Set(prev.board.pieces.map((piece) => piece.id));
  const nextIds = new Set(next.board.pieces.map((piece) => piece.id));
  const side = prev.turn;
  const left = prev.board.pieces.filter((p) => p.side === side && !nextIds.has(p.id));
  const arrived = next.board.pieces.filter((p) => p.side === side && !prevIds.has(p.id));
  if (!left.length || !arrived.length) return history;

  // Hoàn tất phong cấp: tốt biến thành quân khác tại cùng một ô.
  if (prev.pendingPromotion != null && left.length === 1 && arrived.length === 1) {
    const [pawn] = left;
    const [promoted] = arrived;
    const last = history.at(-1);
    if (
      pawn.type === PieceType.PAWN &&
      promoted.row === pawn.row &&
      promoted.col === pawn.col &&
      last
    ) {
      return Object.freeze([
        ...history.slice(0, -1),
        Object.freeze({ ...last, promotion: promoted.type }),
      ]);
    }
  }

  const castle = left.length === 2 && arrived.length === 2;
  const from = castle ? left.find((p) => p.type === PieceType.KING) : left[0];
  const to = castle
    ? arrived.find((p) => p.type === PieceType.KING)
    : arrived.find((p) => p.type === from?.type) ?? arrived[0];
  if (!from || !to) return EMPTY_HISTORY;

  const opponentBefore = prev.board.pieces.length - prev.board.pieces.filter((p) => p.side === side).length;
  const opponentAfter = next.board.pieces.length - next.board.pieces.filter((p) => p.side === side).length;
  const capture = opponentAfter < opponentBefore;
  const enPassant =
    from.type === PieceType.PAWN &&
    capture &&
    from.col !== to.col &&
    prev.board.pieceAt(to.row, to.col) == null;

  return Object.freeze([
    ...history,
    Object.freeze({
      side,
      from: position(from),
      to: position(to),
      pieceType: from.type,
      promotion: null,
      kind: castle ? MoveKind.CASTLE : enPassant ? MoveKind.EN_PASSANT : MoveKind.NORMAL,
      capture,
    }),
  ]);
}
