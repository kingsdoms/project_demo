// tests/rule.test.js
// Kiểm tra class Rule (các setter, check, test, getter) và RuleSet.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Rule } from '../core/models/Rule.js';
import { RuleSet } from '../core/models/RuleSet.js';

describe('Rule: setter', () => {
  it('setValueEqual đạt thì không throw, sai thì throw đúng thông báo', () => {
    const r = new Rule().setValueEqual('a.b', 1, 'phải là 1');
    r.check({ a: { b: 1 } });
    assert.throws(() => r.check({ a: { b: 2 } }), { message: 'phải là 1' });
  });

  it('setValueIn kiểm tra theo danh sách', () => {
    const r = new Rule().setValueIn('x', [1, 2], 'không trong danh sách');
    r.check({ x: 2 });
    assert.throws(() => r.check({ x: 3 }), { message: 'không trong danh sách' });
  });

  it('setType kiểm tra theo giá trị của enum', () => {
    const Color = Object.freeze({ W: 'w', B: 'b' });
    const r = new Rule().setType('side', Color, 'không phải màu');
    r.check({ side: 'w' });
    assert.throws(() => r.check({ side: 'x' }), { message: 'không phải màu' });
  });

  it('setCheck nhận đúng các key khai báo', () => {
    const r = new Rule().setCheck(['piece'], ({ piece }) => piece.row === 0, 'sai hàng');
    r.check({ piece: { row: 0 } });
    assert.throws(() => r.check({ piece: { row: 1 } }), { message: 'sai hàng' });
  });

  it('setter nối tiếp và trả về chính rule', () => {
    const r = new Rule();
    assert.equal(r.setValueEqual('a', 1), r);
    assert.equal(r.setValueIn('b', [1]), r);
  });
});

describe('Rule: check và test', () => {
  it('check throw thông báo của điều kiện đầu tiên không đạt, theo thứ tự thêm vào', () => {
    const r = new Rule().setValueEqual('a', 1, 'lỗi A').setValueEqual('b', 1, 'lỗi B');
    assert.throws(() => r.check({ a: 2, b: 2 }), { message: 'lỗi A' });
    assert.throws(() => r.check({ a: 1, b: 2 }), { message: 'lỗi B' });
  });

  it('test trả về true hoặc false, không throw khi điều kiện sai', () => {
    const r = new Rule().setValueEqual('a', 1);
    assert.equal(r.test({ a: 1 }), true);
    assert.equal(r.test({ a: 2 }), false);
  });

  it('check và test đều báo missing key trước khi chạy điều kiện nào', () => {
    let called = false;
    const r = new Rule().setCheck(['piece'], () => { called = true; return true; });
    assert.throws(() => r.check({}), { message: 'missing key: piece' });
    assert.throws(() => r.test({}), { message: 'missing key: piece' });
    assert.equal(called, false);
  });

  it('key lồng nhau thiếu cũng báo missing key', () => {
    const r = new Rule().setValueEqual('rook.hasMoved', false);
    assert.throws(() => r.check({ rook: null }), { message: 'missing key: rook.hasMoved' });
  });

  it('null là giá trị hợp lệ, không bị coi là thiếu key', () => {
    const r = new Rule().setValueEqual('state.result', null, 'đã kết thúc');
    r.check({ state: { result: null } });
    assert.throws(() => r.check({ state: { result: 'x' } }), { message: 'đã kết thúc' });
  });
});

describe('Rule: getter', () => {
  it('đọc lại đúng cấu hình đã set', () => {
    const Color = Object.freeze({ W: 'w' });
    const list = Object.freeze([1, 2]);
    const r = new Rule().setType('side', Color).setValueEqual('a', 'x').setValueIn('b', list);
    assert.equal(r.getType('side'), Color);
    assert.equal(r.getValueEqual('a'), 'x');
    assert.equal(r.getValueIn('b'), list);
  });

  it('throw khi field chưa được set bằng setter tương ứng', () => {
    const r = new Rule().setValueEqual('a', 1);
    assert.throws(() => r.getValueIn('a'), /Không có setValueIn cho "a"/);
    assert.throws(() => r.getType('a'), /Không có setType cho "a"/);
  });
});

describe('Rule: đóng gói', () => {
  it('điều kiện là private, không lộ ra ngoài', () => {
    assert.deepEqual(Object.keys(new Rule().setValueEqual('a', 1)), []);
  });
});

describe('RuleSet', () => {
  it('add rồi get trả về đúng rule', () => {
    const set = new RuleSet();
    const r = new Rule();
    set.add('X', r);
    assert.equal(set.get('X'), r);
  });

  it('báo lỗi khi trùng key hoặc không có key', () => {
    const set = new RuleSet().add('X', new Rule());
    assert.throws(() => set.add('X', new Rule()), /đã tồn tại/);
    assert.throws(() => set.get('Y'), /Không có rule "Y"/);
  });

  it('entries giữ thứ tự đăng ký', () => {
    const set = new RuleSet().add('B', new Rule()).add('A', new Rule());
    assert.deepEqual(set.entries().map(([k]) => k), ['B', 'A']);
  });
});