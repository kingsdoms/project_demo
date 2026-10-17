// tests/board.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Board } from '../core/Board.js';

const piece = (id, row, col) => ({ id, row, col, type: 'pawn', side: 'w', hasMoved: false });

// Board bất biến nên có thể dùng chung một bàn cho các test đọc
const board = new Board(8, 8, [piece('w-r-0', 7, 0), piece('b-r-0', 0, 0), piece('w-p-0', 6, 3)]);

describe('khởi tạo', () => {
  it('đóng băng Board và danh sách quân', () => {
    assert.equal(Object.isFrozen(board), true);
    assert.equal(Object.isFrozen(board.pieces), true);
  });

  it('getter rows không ghi đè được', () => {
    assert.equal(board.rows, 8);
    assert.throws(() => { board.rows = 9; }, TypeError);
  });

  it('báo lỗi khi kích thước không hợp lệ', () => {
    assert.throws(() => new Board(0, 8), /rows phải là số nguyên dương/);
    assert.throws(() => new Board(8, -1), /cols phải là số nguyên dương/);
  });

  it('báo lỗi khi quân nằm ngoài bàn', () => {
    assert.throws(() => new Board(8, 8, [piece('x', 8, 0)]), /x nằm ngoài bàn/);
    assert.throws(() => new Board(8, 8, [piece('x', 1.5, 0)]), /x nằm ngoài bàn/);
  });

  it('báo lỗi khi hai quân cùng ô hoặc trùng id', () => {
    assert.throws(() => new Board(8, 8, [piece('a', 1, 1), piece('b', 1, 1)]), /Hai quân cùng ô \(1,1\)/);
    assert.throws(() => new Board(8, 8, [piece('a', 1, 1), piece('a', 2, 2)]), /id trùng: a/);
  });
});

describe('inBounds, pieceAt, pieceById', () => {
  it('inBounds đúng ở biên và ngoài biên, từ chối số không nguyên', () => {
    assert.equal(board.inBounds(0, 0), true);
    assert.equal(board.inBounds(7, 7), true);
    assert.equal(board.inBounds(8, 0), false);
    assert.equal(board.inBounds(-1, 0), false);
    assert.equal(board.inBounds(1.5, 0), false);
  });

  it('pieceAt trả về quân hoặc null khi ô trống', () => {
    assert.equal(board.pieceAt(6, 3).id, 'w-p-0');
    assert.equal(board.pieceAt(5, 5), null);
  });

  it('pieceById trả về quân hoặc null', () => {
    assert.equal(board.pieceById('b-r-0').row, 0);
    assert.equal(board.pieceById('nope'), null);
  });
});

describe('ray', () => {
  it('đi tới quân đầu tiên và trả về kèm quân đó', () => {
    const up = board.ray(7, 0, -1, 0);
    assert.equal(up.length, 7);
    assert.equal(up[0].occupant, null);
    assert.equal(up.at(-1).row, 0);
    assert.equal(up.at(-1).occupant.id, 'b-r-0');
  });

  it('dừng sau maxSteps ô', () => {
    assert.equal(board.ray(7, 0, -1, 0, 2).length, 2);
  });

  it('rỗng khi ô kế tiếp đã nằm ngoài bàn', () => {
    assert.deepEqual(board.ray(0, 0, -1, 0), []);
  });

  it('báo lỗi khi hướng, ô xuất phát hoặc maxSteps sai', () => {
    assert.throws(() => board.ray(7, 0, 0, 0), /Hướng phải là/);
    assert.throws(() => board.ray(8, 0, -1, 0), /nằm ngoài bàn/);
    assert.throws(() => board.ray(7, 0, -1, 0, 0), /maxSteps/);
  });
});

describe('thay đổi trả về Board mới, Board cũ không đổi', () => {
  it('replace', () => {
    const moved = board.replace({ ...board.pieceById('w-p-0'), row: 5, col: 3, hasMoved: true });
    assert.equal(moved.pieceById('w-p-0').row, 5);
    assert.equal(board.pieceById('w-p-0').row, 6);
  });

  it('add', () => {
    assert.equal(board.add(piece('w-n-1', 7, 1)).pieces.length, 4);
    assert.equal(board.pieces.length, 3);
  });

  it('remove', () => {
    assert.equal(board.remove('b-r-0').pieces.length, 2);
    assert.equal(board.pieceById('b-r-0').row, 0);
  });

  it('expand thêm cột bên phải, quân giữ vị trí', () => {
    const wider = board.expand(1);
    assert.equal(wider.cols, 9);
    assert.equal(board.cols, 8);
    assert.equal(wider.inBounds(0, 8), true);
    assert.equal(wider.pieceById('w-p-0').col, 3);
  });

  it('ăn quân: xóa quân bị ăn trước rồi đưa quân đi tới ô đó', () => {
    const captured = board.remove('b-r-0').replace({ ...board.pieceById('w-p-0'), row: 0, col: 0 });
    assert.equal(captured.pieceAt(0, 0).id, 'w-p-0');
  });

  it('báo lỗi khi thay, xóa, mở rộng sai', () => {
    assert.throws(() => board.replace(piece('ghost', 1, 1)), /Không có quân ghost để thay/);
    assert.throws(() => board.replace({ ...board.pieceById('w-p-0'), row: 0, col: 0 }), /Hai quân cùng ô \(0,0\)/);
    assert.throws(() => board.remove('ghost'), /Không có quân ghost để xóa/);
    assert.throws(() => board.expand(0), /extraCols phải là số nguyên dương/);
  });
});