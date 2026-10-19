// tests/chessRules.test.js
// Kiểm tra 13 luật cờ vua. Mỗi luật có ít nhất một trường hợp đạt và một trường hợp sai.
// Cần file constants/PieceType.js của bạn để chạy.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gameRules } from '../core/rules/gameRules.js';
import { boardRules } from '../core/rules/boardRules.js';
import { pieceRules, PROMOTE_TARGETS } from '../core/rules/pieceRules.js';
import { outcomeRules } from '../core/rules/outcomeRules.js';
import { PieceType } from '../core/constants/PieceType.js';

const ALL_KEYS = [
  'TURN', 'GAME_NOT_OVER', 'PROMOTION_PENDING',
  'IN_BOARD', 'PATTERN', 'NOT_ALLY_TARGET', 'NOT_SELF_CHECK', 'CASTLE', 'EN_PASSANT',
  'PROMOTE',
  'checkmate', 'stalemate', 'insufficientMaterial',
];

describe('cấu trúc', () => {
  it('đủ 13 luật và không trùng key giữa các bộ', () => {
    const keys = [gameRules, boardRules, pieceRules, outcomeRules]
      .flatMap((set) => set.entries().map(([key]) => key));
    assert.equal(new Set(keys).size, keys.length);
    assert.deepEqual([...keys].sort(), [...ALL_KEYS].sort());
  });
});

describe('luật ván', () => {
  it('TURN: quân phải thuộc bên tới lượt', () => {
    const r = gameRules.get('TURN');
    r.check({ piece: { side: 'w' }, turn: 'w' });
    assert.throws(() => r.check({ piece: { side: 'b' }, turn: 'w' }), { message: 'Không phải lượt của bạn' });
    assert.throws(() => r.check({ piece: { side: 'w' } }), { message: 'missing key: turn' });
  });

  it('GAME_NOT_OVER: ván đã kết thúc thì từ chối', () => {
    const r = gameRules.get('GAME_NOT_OVER');
    r.check({ state: { result: null } });
    assert.throws(() => r.check({ state: { result: 'checkmate' } }), { message: 'Ván đã kết thúc' });
  });

  it('PROMOTION_PENDING: đang chờ phong thì chặn nước khác', () => {
    const r = gameRules.get('PROMOTION_PENDING');
    r.check({ move: { blockedByPromotion: false } });
    assert.throws(() => r.check({ move: { blockedByPromotion: true } }), { message: 'Phải phong cấp quân trước' });
  });
});

describe('luật nước đi trên bàn', () => {
  const move = (o = {}) => ({ inBoard: true, reachable: true, targetIsAlly: false, exposesKing: false, ...o });
  const cases = [
    ['IN_BOARD', { inBoard: false }, 'Ô đích nằm ngoài bàn'],
    ['PATTERN', { reachable: false }, 'Quân này không đi tới ô đó'],
    ['NOT_ALLY_TARGET', { targetIsAlly: true }, 'Không được ăn quân cùng bên'],
    ['NOT_SELF_CHECK', { exposesKing: true }, 'Nước đi này để vua bị chiếu'],
  ];
  for (const [key, bad, message] of cases) {
    it(`${key}: đạt khi hợp lệ, throw khi sai`, () => {
      const r = boardRules.get(key);
      r.check({ move: move() });
      assert.throws(() => r.check({ move: move(bad) }), { message });
    });
  }
});

describe('nhập thành', () => {
  const ok = {
    piece: { hasMoved: false },
    rook: { hasMoved: false },
    castle: { pathEmpty: true, inCheck: false, passesAttacked: false },
  };
  const castle = (over) => boardRules.get('CASTLE').check({ ...ok, ...over });

  it('đạt khi mọi điều kiện đúng', () => {
    castle({});
  });

  const cases = [
    ['vua đã đi', { piece: { hasMoved: true } }, 'Vua đã đi nên không nhập thành được'],
    ['xe đã đi', { rook: { hasMoved: true } }, 'Xe đã đi nên không nhập thành được'],
    ['ô giữa còn quân', { castle: { ...ok.castle, pathEmpty: false } }, 'Giữa vua và xe còn quân'],
    ['đang bị chiếu', { castle: { ...ok.castle, inCheck: true } }, 'Không nhập thành khi đang bị chiếu'],
    ['đi qua ô bị chiếu', { castle: { ...ok.castle, passesAttacked: true } }, 'Vua không được đi qua hoặc tới ô bị chiếu'],
  ];
  for (const [name, over, message] of cases) {
    it(`từ chối khi ${name}`, () => {
      assert.throws(() => castle(over), { message });
    });
  }

  it('engine không tìm được xe thì báo missing key', () => {
    assert.throws(() => castle({ rook: undefined }), { message: 'missing key: rook.hasMoved' });
  });
});

describe('bắt qua đường', () => {
  const ok = { targetMatches: true, capturedPawnJustDoubled: true };
  const passant = (over) => boardRules.get('EN_PASSANT').check({ passant: { ...ok, ...over } });

  it('đạt khi đúng ô và tốt bị bắt vừa đi hai ô', () => {
    passant({});
  });

  it('từ chối khi không phải ô vừa được bỏ qua', () => {
    assert.throws(() => passant({ targetMatches: false }),
      { message: 'Bắt qua đường chỉ áp dụng cho ô vừa được bỏ qua' });
  });

  it('từ chối khi tốt bị bắt không vừa đi hai ô', () => {
    assert.throws(() => passant({ capturedPawnJustDoubled: false }), { message: 'Tốt bị bắt phải vừa đi hai ô' });
  });
});

describe('phong cấp', () => {
  const promote = pieceRules.get('PROMOTE');
  const pawn = (side, row) => ({ type: PieceType.PAWN, side, row });
  const input = (piece, newPieceType) => ({ pieceType: piece.type, piece, newPieceType });

  it('getValueIn trả về đúng danh sách quân được chọn', () => {
    assert.equal(promote.getValueIn('newPieceType'), PROMOTE_TARGETS);
  });

  it('mọi quân trong danh sách đều hợp lệ khi tốt ở hàng cuối', () => {
    const valid = PROMOTE_TARGETS.filter((t) => promote.test(input(pawn('w', 0), t)));
    assert.deepEqual(valid, [...PROMOTE_TARGETS]);
  });

  it('chỉ tốt được phong', () => {
    const knight = { type: PieceType.KNIGHT, side: 'w', row: 0 };
    assert.throws(() => promote.check(input(knight, PieceType.QUEEN)), { message: 'Chỉ tốt được phong cấp' });
  });

  it('tốt phải ở hàng cuối của bên mình', () => {
    promote.check(input(pawn('b', 7), PieceType.KNIGHT));
    assert.throws(() => promote.check(input(pawn('w', 3), PieceType.QUEEN)), { message: 'Tốt chưa tới hàng cuối' });
    assert.throws(() => promote.check(input(pawn('b', 0), PieceType.QUEEN)), { message: 'Tốt chưa tới hàng cuối' });
  });

  it('chỉ được chọn quân trong danh sách', () => {
    assert.throws(() => promote.check(input(pawn('w', 0), PieceType.KING)),
      { message: 'Không được phong thành quân này' });
  });

  it('thiếu key thì báo missing key', () => {
    assert.throws(() => promote.check({ piece: pawn('w', 0), newPieceType: PieceType.QUEEN }),
      { message: 'missing key: pieceType' });
  });
});

describe('kết thúc ván', () => {
  const pos = (o = {}) => ({ inCheck: false, hasLegalMove: true, insufficientMaterial: false, ...o });
  const endedBy = (position) => outcomeRules.entries()
    .filter(([, rule]) => rule.test({ position }))
    .map(([result]) => result);

  it('chiếu hết', () => {
    assert.deepEqual(endedBy(pos({ inCheck: true, hasLegalMove: false })), ['checkmate']);
  });

  it('hết nước khi không bị chiếu là hòa', () => {
    assert.deepEqual(endedBy(pos({ hasLegalMove: false })), ['stalemate']);
  });

  it('thiếu quân để chiếu hết là hòa', () => {
    assert.deepEqual(endedBy(pos({ insufficientMaterial: true })), ['insufficientMaterial']);
  });

  it('ván còn tiếp tục thì không có kết quả', () => {
    assert.deepEqual(endedBy(pos()), []);
  });

  it('thiếu key thì báo missing key', () => {
    assert.throws(() => outcomeRules.get('checkmate').test({}), { message: 'missing key: position.inCheck' });
  });
});