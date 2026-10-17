// core/Rule.js
// Một luật, dựng từ một mục trong RuleDefs. Rule không biết luật cụ thể là gì.
// Nó ghép giá trị truyền vào với tên trong args, rồi đánh giá từng điều kiện theo CheckType.
//   allowed(...values): trả về danh sách lựa chọn, [] nếu không được phép.
//   check(...values):   không trả gì nếu hợp lệ, throw nếu không hợp lệ.
//   outcome(...values): trả về result nếu điều kiện kết thúc ván đúng, null nếu không.

import { CheckType } from '../constants/RuleType.js';
import { PIECE_DEFS } from '../constants/PieceDefs.js';

export class Rule {
  #key;
  #params;
  #allowed;
  #check;
  #outcome;

  constructor(key, def) {
    this.#key = key;
    this.#params = def.params ?? {};
    this.#allowed = def.allowed ?? null;
    this.#check = def.check ?? null;
    this.#outcome = def.outcome ?? null;
    Object.freeze(this);
  }

  get key() { return this.#key; }

  allowed(...values) {
    if (this.#allowed === null) {
      throw new Error(`Rule "${this.#key}" không khai báo allowed`);
    }
    const input = Object.fromEntries(this.#allowed.args.map((name, i) => [name, values[i]]));
    const ok = this.#allowed.conditions.every((c) => this.#holds(c, input));
    return ok ? this.#params[this.#allowed.options] : [];
  }

  check(...values) {
    if (this.#check === null) {
      throw new Error(`Rule "${this.#key}" không khai báo check`);
    }
    const input = Object.fromEntries(this.#check.args.map((name, i) => [name, values[i]]));
    for (const c of this.#check.conditions) {
      if (!this.#holds(c, input)) {
        throw new Error(c.error);
      }
    }
  }

  outcome(...values) {
    if (this.#outcome === null) {
      throw new Error(`Rule "${this.#key}" không khai báo outcome`);
    }
    const input = Object.fromEntries(this.#outcome.args.map((name, i) => [name, values[i]]));
    const ok = this.#outcome.conditions.every((c) => this.#holds(c, input));
    return ok ? this.#outcome.result : null;
  }

  #holds(c, input) {
    switch (c.type) {
      case CheckType.DEF_FLAG: {
        const pieceType = c.prop ? input[c.arg][c.prop] : input[c.arg];
        return PIECE_DEFS[pieceType]?.[c.flag] === true;
      }
      case CheckType.ON_RANK: {
        const piece = input[c.arg];
        return piece.row === this.#params[c.param][piece.side];
      }
      case CheckType.IN_LIST:
        return this.#params[c.param].includes(input[c.arg]);
      case CheckType.IS_TRUE:
        return (c.prop ? input[c.arg][c.prop] : input[c.arg]) === true;
      case CheckType.IS_FALSE:
        return (c.prop ? input[c.arg][c.prop] : input[c.arg]) === false;
      case CheckType.IS_NULL:
        return (c.prop ? input[c.arg][c.prop] : input[c.arg]) === null;
      case CheckType.SAME: {
        const a = c.prop ? input[c.arg][c.prop] : input[c.arg];
        const b = c.otherProp ? input[c.other][c.otherProp] : input[c.other];
        return a === b;
      }
      default:
        throw new Error(`Rule "${this.#key}": CheckType không biết: ${c.type}`);
    }
  }
}