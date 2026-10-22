// tests/simpleBot.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSimpleBot } from "../bot/simpleBot.js";
import { reduce } from "../core/engine/reduce.js";
import { Game } from "../core/models/Game.js";
import { Board } from "../core/models/Board.js";
import { Piece } from "../core/models/Piece.js";
import { ActionType } from "../core/constants/ActionType.js";
import { PieceType } from "../core/constants/PieceType.js";
import { Side } from "../core/constants/Side.js";
import { Action } from "../core/models/Action.js";

describe("Action.promote", () => {
  it("nhận một tham số là loại quân", () => {
    const a = Action.promote(PieceType.QUEEN);
    assert.equal(a.type, ActionType.PROMOTE);
    assert.equal(a.pieceType, PieceType.QUEEN);
  });

  it("truyền nhầm id vào vị trí pieceType thì bị từ chối", () => {
    assert.throws(() => Action.promote("PAWN-WHITE-0-3"), { name: "GameError" });
  });
});

// rng có hạt giống (mulberry32) để test lặp lại được
function seeded(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const P = (type, side, row, col) => new Piece({ type, side, row, col });
const gameOf = (pieces, extra = {}) =>
  new Game({ board: new Board(8, 8, pieces), ...extra });

describe("simpleBot: chọn nước", () => {
  it("ưu tiên ăn quân giá trị cao nhất", () => {
    // Xe trắng (4,3) ăn được tốt đen (2,3) hoặc hậu đen (4,6)
    const game = gameOf([
      P(PieceType.KING, Side.WHITE, 7, 4),
      P(PieceType.ROOK, Side.WHITE, 4, 3),
      P(PieceType.KING, Side.BLACK, 0, 0),
      P(PieceType.QUEEN, Side.BLACK, 4, 6),
      P(PieceType.PAWN, Side.BLACK, 2, 3),
    ]);
    for (let seed = 1; seed <= 20; seed++) {
      const action = createSimpleBot({ rng: seeded(seed) })(game);
      assert.equal(action.type, ActionType.MOVE);
      assert.equal(action.id, "ROOK-WHITE-4-3");
      assert.equal(action.row, 4);
      assert.equal(action.col, 6);
    }
  });

  it("trả về null khi ván đã kết thúc", () => {
    const game = gameOf(
      [P(PieceType.KING, Side.WHITE, 7, 4), P(PieceType.KING, Side.BLACK, 0, 0)],
      { result: { type: "CHECKMATE", winner: Side.WHITE } },
    );
    assert.equal(createSimpleBot()(game), null);
  });
});

describe("simpleBot: phong cấp", () => {
  it("tốt tới hàng cuối thì bot trả về PROMOTE hậu, reduce chấp nhận", () => {
    const pawn = P(PieceType.PAWN, Side.WHITE, 0, 3);
    const game = gameOf(
      [
        pawn,
        P(PieceType.KING, Side.WHITE, 7, 4),
        P(PieceType.KING, Side.BLACK, 0, 7),
      ],
      { pendingPromotion: pawn.id },
    );
    const action = createSimpleBot()(game);
    assert.equal(action.type, ActionType.PROMOTE);
    assert.equal(action.pieceType, PieceType.QUEEN);

    const next = reduce(game, action);
    assert.equal(next.pendingPromotion, null);
    assert.equal(next.board.pieceAt(0, 3).type, PieceType.QUEEN);
    assert.equal(next.turn, Side.BLACK);
  });
});

describe("simpleBot: bot đấu bot", () => {
  it("chạy 200 action không lỗi, mọi action đều được reduce chấp nhận", () => {
    const bot = createSimpleBot({ rng: seeded(42) });
    let game = Game.initialStandard();
    let actions = 0;
    let games = 1;
    let promotions = 0;

    while (actions < 200) {
      if (game.result !== null) {
        // Ván kết thúc sớm: mở ván mới để đủ 200 action
        game = Game.initialStandard();
        games++;
      }
      const action = bot(game);
      assert.notEqual(action, null, `bot trả về null khi ván chưa kết thúc (action #${actions})`);
      if (action.type === ActionType.PROMOTE) promotions++;
      game = reduce(game, action); // ném GameError nếu bot đi sai luật
      actions++;
    }

    assert.equal(actions, 200);
    console.log(`  ${games} ván, ${promotions} lần phong cấp`);
  });

  it("nhiều hạt giống khác nhau đều không lỗi", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const bot = createSimpleBot({ rng: seeded(seed) });
      let game = Game.initialStandard();
      for (let i = 0; i < 200 && game.result === null; i++) {
        game = reduce(game, bot(game));
      }
    }
  });
});