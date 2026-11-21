import assert from "node:assert/strict";
import { test } from "node:test";
import chess, { GameMode } from "../index.js";
import { Side } from "../core/constants/Side.js";

test("VS_BOT lets the screen select the human side", (t) => {
  const white = chess.create({
    mode: GameMode.VS_BOT,
    humanSide: Side.WHITE,
    botDelay: 60_000,
    botEngine: "simple", // Pure API-side test; Stockfish protocol is tested separately.
  });
  t.after(() => white.destroy());
  assert.equal(white.getView().turn, Side.WHITE);
  assert.equal(white.getView().canAct, true);

  const black = chess.create({
    mode: GameMode.VS_BOT,
    humanSide: Side.BLACK,
    botDelay: 60_000,
    botEngine: "simple",
  });
  t.after(() => black.destroy());
  assert.equal(black.getView().turn, Side.WHITE);
  assert.equal(black.getView().canAct, false);
});

test("unsupported chess modes and sides fail clearly", () => {
  assert.throws(() => chess.create({ mode: GameMode.ONLINE }), /requires a matched room/);
  assert.throws(
    () => chess.create({ mode: GameMode.VS_BOT, humanSide: "GREEN" }),
    /Unsupported player side/,
  );
});
