/**
 * @file Rule.js
 * @author tuanca
 */

import { GameError } from "../../utils/GameError.js";
import { ErrorCode } from "../../constants/ErrorCode.js";
// Một rule là danh sách ràng buộc. Các setter thêm ràng buộc và trả về chính rule để nối tiếp.
// Mọi key truyền vào setter đều là bắt buộc. Thiếu key thì check và test throw "missing key" trước khi xét điều kiện.
// Ràng buộc được giữ private. Các getter đọc lại cấu hình của từng field.
 
export class Rule {
  #constraints = [];
  #requiredKeys = new Set();
 
  // Giá trị của field phải là một trong các giá trị của enumObj
  setType(field, enumObj, message = `${field} không hợp lệ`) {
    return this.#add({ kind: 'type', keys: [field], field, value: enumObj, message });
  }
 
  // Giá trị của field phải bằng value
  setValueEqual(field, value, message = `${field} phải là ${value}`) {
    return this.#add({ kind: 'equal', keys: [field], field, value, message });
  }
 
  // Giá trị của field phải nằm trong list
  setValueIn(field, list, message = `${field} không nằm trong danh sách cho phép`) {
    return this.#add({ kind: 'in', keys: [field], field, value: list, message });
  }
 
  // Điều kiện tự viết. keys là các field fn cần. fn nhận input và trả về true nếu đạt.
  setCheck(keys, fn, message = 'Điều kiện không đạt') {
    return this.#add({ kind: 'check', keys, fn, message });
  }
 
  // Getter: đọc lại enumObj đã truyền vào setType
  getType(field) {
    const c = this.#constraints.find((x) => x.kind === 'type' && x.field === field);
    if (!c) throw new GameError(ErrorCode.INVALID_ARGUMENT, `Không có setType cho "${field}"`);
    return c.value;
  }
 
  // Getter: đọc lại value đã truyền vào setValueEqual
  getValueEqual(field) {
    const c = this.#constraints.find((x) => x.kind === 'equal' && x.field === field);
    if (!c) throw new GameError(ErrorCode.INVALID_ARGUMENT, `Không có setValueEqual cho "${field}"`);
    return c.value;
  }
 
  // Getter: đọc lại list đã truyền vào setValueIn
  getValueIn(field) {
    const c = this.#constraints.find((x) => x.kind === 'in' && x.field === field);
    if (!c) throw new GameError(ErrorCode.INVALID_ARGUMENT, `Không có setValueIn cho "${field}"`);
    return c.value;
  }
 
  // Throw "missing key" nếu thiếu key, throw thông báo của điều kiện đầu tiên không đạt
  check(input) {
    const missing = this.#missingKey(input);
    if (missing !== null) throw new GameError(ErrorCode.INVALID_ARGUMENT, `missing key: ${missing}`);
    const failed = this.#firstFailure(input);
    if (failed !== null) throw new GameError(ErrorCode.SELF_CHECK, failed);
  }
 
  // Trả về true hoặc false, dùng để lọc lựa chọn. Vẫn throw "missing key" nếu thiếu key vì đó là lỗi lập trình.
  test(input) {
    const missing = this.#missingKey(input);
    if (missing !== null) throw new GameError(ErrorCode.INVALID_ARGUMENT, `missing key: ${missing}`);
    return this.#firstFailure(input) === null;
  }
 
  #add(constraint) {
    this.#constraints.push(constraint);
    for (const key of constraint.keys) {
      this.#requiredKeys.add(key);
    }
    return this;
  }
 
  // Đọc giá trị theo đường dẫn, ví dụ "piece.side"
  #read(input, field) {
    return field.split('.').reduce((obj, key) => obj?.[key], input);
  }
 
  #missingKey(input) {
    for (const key of this.#requiredKeys) {
      if (this.#read(input, key) === undefined) return key;
    }
    return null;
  }
 
  #firstFailure(input) {
    const failed = this.#constraints.find((c) => !this.#holds(c, input));
    return failed ? failed.message : null;
  }
 
  #holds(c, input) {
    switch (c.kind) {
      case 'type':
        return Object.values(c.value).includes(this.#read(input, c.field));
      case 'equal':
        return this.#read(input, c.field) === c.value;
      case 'in':
        return c.value.includes(this.#read(input, c.field));
      case 'check':
        return c.fn(input);
    }
  }
}