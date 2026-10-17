// tests/pieceDefs.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PIECE_DEFS, validatePieceDefs } from '../constants/PieceDefs.js';

const valid = () => ({ a: { name: 'A', value: 1, royal: true, canPromote: false } });

describe('PIECE_DEFS', () => {
  it('đóng băng sâu', () => {
    assert.equal(Object.isFrozen(PIECE_DEFS), true);
    assert.equal(Object.isFrozen(PIECE_DEFS.queen), true);
    assert.throws(() => { PIECE_DEFS.queen.value = 100; }, TypeError);
  });

  it('đúng một quân royal, và chỉ tốt được phong', () => {
    const royals = Object.keys(PIECE_DEFS).filter((t) => PIECE_DEFS[t].royal);
    const promotable = Object.keys(PIECE_DEFS).filter((t) => PIECE_DEFS[t].canPromote);
    assert.deepEqual(royals, ['king']);
    assert.deepEqual(promotable, ['pawn']);
  });
});

describe('validatePieceDefs', () => {
  it('nhận cấu hình hợp lệ', () => {
    const defs = valid();
    assert.equal(validatePieceDefs(defs), defs);
  });

  const bad = [
    ['không phải object', null, /phải là object/],
    ['name rỗng', { a: { name: '', value: 1, royal: true, canPromote: false } }, /name phải là chuỗi/],
    ['value âm', { a: { name: 'A', value: -1, royal: true, canPromote: false } }, /value phải là số nguyên/],
    ['value không nguyên', { a: { name: 'A', value: 1.5, royal: true, canPromote: false } }, /value phải là số nguyên/],
    ['royal sai kiểu', { a: { name: 'A', value: 1, royal: 'yes', canPromote: false } }, /royal phải là/],
    ['thiếu canPromote', { a: { name: 'A', value: 1, royal: true } }, /canPromote phải là/],
    ['trường lạ', { a: { name: 'A', value: 1, royal: true, canPromote: false, moves: [] } }, /trường lạ "moves"/],
    ['không có royal', { a: { name: 'A', value: 1, royal: false, canPromote: false } }, /hiện có 0/],
    ['hai royal', { a: { name: 'A', value: 1, royal: true, canPromote: false },
      b: { name: 'B', value: 1, royal: true, canPromote: false } }, /hiện có 2/],
  ];
  for (const [name, defs, pattern] of bad) {
    it(`từ chối: ${name}`, () => {
      assert.throws(() => validatePieceDefs(defs), pattern);
    });
  }

  it('gom nhiều lỗi vào một thông báo', () => {
    assert.throws(
      () => validatePieceDefs({ a: { name: '', value: -1, royal: 1, canPromote: false } }),
      (e) => /name phải là chuỗi/.test(e.message)
        && /value phải là số nguyên/.test(e.message)
        && /royal phải là/.test(e.message),
    );
  });
});