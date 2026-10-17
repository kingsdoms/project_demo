// tests/actions.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ActionType, Actions, checkShape } from '../core/actions.js';

describe('Actions', () => {
  it('tạo đúng hình dạng', () => {
    assert.deepEqual(Actions.move('w-p-4', 4, 4), { type: 'MOVE', id: 'w-p-4', row: 4, col: 4 });
    assert.deepEqual(Actions.promote('w-p-0', 'queen'), { type: 'PROMOTE', id: 'w-p-0', pieceType: 'queen' });
  });

  it('JSON round-trip giữ nguyên', () => {
    const a = Actions.move('b-n-1', 2, 5);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
  });

  it('ActionType bị khóa', () => {
    assert.throws(() => { ActionType.MOVE = 'X'; }, TypeError);
  });
});

describe('checkShape', () => {
  it('chấp nhận action đúng hình dạng', () => {
    assert.equal(checkShape(Actions.move('w-p-4', 4, 4)), null);
    assert.equal(checkShape(Actions.promote('w-p-0', 'queen')), null);
  });

  const bad = [
    ['null', null],
    ['chuỗi', 'MOVE'],
    ['row là chuỗi', { type: 'MOVE', id: 'w-p-4', row: '4', col: 4 }],
    ['row không nguyên', { type: 'MOVE', id: 'w-p-4', row: 4.5, col: 4 }],
    ['id rỗng', { type: 'MOVE', id: '', row: 4, col: 4 }],
    ['thiếu col', { type: 'MOVE', id: 'w-p-4', row: 4 }],
    ['PROMOTE thiếu pieceType', { type: 'PROMOTE', id: 'w-p-0' }],
    ['PLAY_CARD đã bỏ', { type: 'PLAY_CARD', cardId: 'x' }],
    ['RESIGN chưa có', { type: 'RESIGN' }],
  ];
  for (const [name, action] of bad) {
    it(`từ chối: ${name}`, () => {
      assert.notEqual(checkShape(action), null);
    });
  }
});