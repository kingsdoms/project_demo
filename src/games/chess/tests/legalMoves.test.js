import assert from "node:assert/strict";
import { test } from "node:test";
import { MoveKind } from "../core/constants/MoveKind.js";
import { PieceType } from "../core/constants/PieceType.js";
import { Side } from "../core/constants/Side.js";
import { getAllLegalMoves, getLegalMoves } from "../core/engine/legalMoves.js";
import { reduce } from "../core/engine/reduce.js";
import { Action } from "../core/models/Action.js";
import { Board } from "../core/models/Board.js";
import { Game } from "../core/models/Game.js";
import { Piece } from "../core/models/piece.js";
import { Square } from "../core/models/Square.js";

const { BLACK, WHITE } = Side;
const { KING, KNIGHT, PAWN, ROOK } = PieceType;

const pieceAt = (type, side, row, col, hasMoved = false) =>
  new Piece({ type, side, row, col, hasMoved });

function perft(game, depth) {
  if (depth === 0) return 1;
  const moves = getAllLegalMoves(game);
  if (depth === 1) return moves.length;
  return moves.reduce(
    (count, { id, row, col }) =>
      count + perft(reduce(game, Action.move(id, row, col)), depth - 1),
    0,
  );
}

test("counts legal opening move paths through three plies", () => {
  const game = Game.initialStandard();
  assert.deepEqual([1, 2, 3].map((depth) => perft(game, depth)), [20, 400, 8902]);
});

test("rejects castling through a pawn attack on the empty transit square", () => {
  const king = pieceAt(KING, WHITE, 7, 4);
  const pieces = [king, pieceAt(ROOK, WHITE, 7, 7), pieceAt(KING, BLACK, 0, 4)];
  const canCastle = (position) => {
    const game = new Game({ board: new Board(8, 8, position) });
    return getLegalMoves(game, king).some(({ kind }) => kind === MoveKind.CASTLE);
  };

  assert.equal(canCastle(pieces), true);
  assert.equal(canCastle([...pieces, pieceAt(PAWN, BLACK, 6, 6)]), false);
});

test("rejects an en passant capture that uncovers a rook check", () => {
  const pawn = pieceAt(PAWN, WHITE, 3, 2, true);
  const pieces = [
    pieceAt(KING, WHITE, 3, 0),
    pawn,
    pieceAt(PAWN, BLACK, 3, 3, true),
    pieceAt(KING, BLACK, 0, 0),
  ];
  const canCapture = (position) => {
    const game = new Game({
      board: new Board(8, 8, position),
      enPassantTarget: new Square({ row: 2, col: 3 }),
    });
    return getLegalMoves(game, pawn).some(({ kind }) => kind === MoveKind.EN_PASSANT);
  };

  assert.equal(canCapture(pieces), true);
  assert.equal(canCapture([...pieces, pieceAt(ROOK, BLACK, 3, 7)]), false);
});

test("allows promotion to a knight and completes the turn afterwards", () => {
  const pawn = pieceAt(PAWN, WHITE, 1, 3, true);
  const board = new Board(8, 8, [pawn, pieceAt(KING, WHITE, 7, 4), pieceAt(KING, BLACK, 0, 7)]);
  const game = reduce(new Game({ board }), Action.move(pawn.id, 0, 3));

  assert.equal(game.pendingPromotion, game.board.pieceAt(0, 3).id);
  assert.equal(game.turn, WHITE);
  assert.deepEqual(getAllLegalMoves(game), []);

  const promoted = reduce(game, Action.promote(KNIGHT));
  assert.equal(promoted.pendingPromotion, null);
  assert.equal(promoted.turn, BLACK);
  assert.equal(promoted.board.pieceAt(0, 3).type, KNIGHT);
});
