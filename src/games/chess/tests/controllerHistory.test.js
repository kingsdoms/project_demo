import assert from "node:assert/strict";
import { test } from "node:test";
import { attachBot } from "../bot/attachBot.js";
import { createController } from "../controller/createController.js";
import { MoveKind } from "../core/constants/MoveKind.js";
import { PieceType } from "../core/constants/PieceType.js";
import { Side } from "../core/constants/Side.js";
import { Room } from "../core/engine/room.js";
import { Action } from "../core/models/Action.js";

const { WHITE, BLACK } = Side;
const { PAWN, KING, QUEEN } = PieceType;
const square = (name) => ({ row: 8 - Number(name[1]), col: "abcdefgh".indexOf(name[0]) });

function move(room, from, to) {
  const start = square(from);
  const end = square(to);
  const piece = room.getState().board.pieceAt(start.row, start.col);
  assert.ok(piece, `Missing piece at ${from}`);
  room.dispatch(Action.move(piece.id, end.row, end.col));
}

function setup(t) {
  const room = new Room();
  const controller = createController({ room, sides: [WHITE, BLACK], dispose: () => room.destroy() });
  t.after(() => controller.destroy());
  return { room, controller };
}

test("history records accepted moves from the player and bot, and clears on restart", { timeout: 2000 }, async (t) => {
  const { room, controller } = setup(t);
  assert.deepEqual(controller.getView().history, []);
  assert.equal(controller.getView().lastMove, null);

  controller.actions.clickSquare(6, 4);
  controller.actions.clickSquare(3, 4);
  assert.deepEqual(controller.getView().history, []);

  controller.actions.clickSquare(6, 4);
  controller.actions.clickSquare(4, 4);
  const opening = controller.getView();
  assert.deepEqual(opening.lastMove, {
    side: WHITE,
    from: square("e2"),
    to: square("e4"),
    pieceType: PAWN,
    promotion: null,
    kind: MoveKind.NORMAL,
    capture: false,
  });

  const bot = attachBot(room, { sides: [BLACK], delay: 0 });
  t.after(bot.stop);
  await new Promise((resolve) => {
    const off = controller.subscribe(() => {
      if (controller.getView().history.length < 2) return;
      off();
      resolve();
    });
  });
  bot.stop();

  const played = controller.getView();
  assert.equal(played.history.length, 2);
  assert.equal(played.lastMove.side, BLACK);
  assert.equal(played.lastMove, played.history[1]);
  assert.equal(opening.history.length, 1);

  room.restart();
  assert.deepEqual(controller.getView().history, []);
  assert.equal(controller.getView().lastMove, null);
  move(room, "d2", "d4");
  controller.actions.restart();
  assert.deepEqual(controller.getView().history, []);
});

test("history represents castling as one king move and identifies en passant as a capture", (t) => {
  const { room, controller } = setup(t);
  for (const [from, to] of [
    ["e2", "e4"], ["a7", "a6"], ["g1", "f3"], ["a6", "a5"],
    ["f1", "e2"], ["b7", "b6"], ["e1", "g1"],
  ]) move(room, from, to);

  const castled = controller.getView();
  assert.equal(castled.history.length, 7);
  assert.deepEqual(castled.lastMove, {
    side: WHITE,
    from: square("e1"),
    to: square("g1"),
    pieceType: KING,
    promotion: null,
    kind: MoveKind.CASTLE,
    capture: false,
  });

  room.restart();
  for (const [from, to] of [
    ["e2", "e4"], ["a7", "a6"], ["e4", "e5"], ["d7", "d5"], ["e5", "d6"],
  ]) move(room, from, to);
  assert.equal(controller.getView().lastMove.kind, MoveKind.EN_PASSANT);
  assert.equal(controller.getView().lastMove.capture, true);
});

test("promotion updates the pawn's history entry without adding a turn", (t) => {
  const { room, controller } = setup(t);
  for (const [from, to] of [
    ["a2", "a4"], ["h7", "h5"], ["a4", "a5"], ["h5", "h4"],
    ["a5", "a6"], ["h4", "h3"], ["a6", "b7"], ["h3", "g2"], ["b7", "a8"],
  ]) move(room, from, to);

  const pending = controller.getView();
  assert.ok(pending.promotion);
  assert.equal(pending.lastMove.promotion, null);

  controller.actions.promote(QUEEN);
  const promoted = controller.getView();
  assert.equal(promoted.history.length, 9);
  assert.equal(promoted.lastMove.promotion, QUEEN);
  assert.equal(promoted.lastMove.pieceType, PAWN);
  assert.equal(promoted.lastMove.capture, true);
  assert.deepEqual(promoted.lastMove.from, square("b7"));
  assert.deepEqual(promoted.lastMove.to, square("a8"));
  assert.equal(pending.lastMove.promotion, null);
});
