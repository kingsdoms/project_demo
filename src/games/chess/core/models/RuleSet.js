/**
 * @file RuleSet.js
 * @author tuanca
 */

export class RuleSet {
  #rules = new Map();

  /**
   * Đăng ký một rule theo key. Ném lỗi nếu key đã tồn tại.
   *
   * @param {string} key - Tên định danh của rule.
   * @param {import("./Rule.js").Rule} rule - Instance Rule cần đăng ký.
   * @returns {this} Trả về instance hiện tại để hỗ trợ chaining.
   * @throws {Error} Nếu key đã được đăng ký.
   */
  add(key, rule) {
    if (this.#rules.has(key)) {
      throw new Error(`Rule "${key}" đã tồn tại`);
    }
    this.#rules.set(key, rule);
    return this;
  }
  /**
   * Lấy rule đã đăng ký theo key.
   *
   * @param {string} key - Tên định danh của rule.
   * @returns {import("./Rule.js").Rule} Rule tương ứng, hoặc `undefined` nếu không tìm thấy.
   */
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
