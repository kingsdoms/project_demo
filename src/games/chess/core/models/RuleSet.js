/**
 * @file RuleSet.js
 * @author tuanca
 */

export class RuleSet {
  #rules = new Map();

  add(key, rule) {
    if (this.#rules.has(key)) {
      throw new Error(`Rule "${key}" đã tồn tại`);
    }
    this.#rules.set(key, rule);
    return this;
  }

  get(key) {
    if (!this.#rules.has(key)) {
      throw new Error(`Không có rule "${key}"`);
    }
    return this.#rules.get(key);
  }

  entries() {
    return [...this.#rules.entries()];
  }
}
