/**
 * @file Rule.js
 * @author tuanca
 */

import { GameError } from "../../utils/GameError.js";
import { ErrorCode } from "../constants/ErrorCode.js";

/**
 * @typedef {
 *   | { kind: "type", keys: string[], field: string, value: Record<string, string | number>, message: string }
 *   | { kind: "equal", keys: string[], field: string, value: unknown, message: string }
 *   | { kind: "in", keys: string[], field: string, value: unknown[], message: string }
 *   | { kind: "check", keys: string[], fn: (input: Record<string, unknown>) => boolean, message: string }
 * } Constraint
 */
/**
 * Quản lý một tập hợp các ràng buộc dùng để kiểm tra điều kiện.
 *
 * Mỗi setter thêm một ràng buộc và trả về chính Rule hiện tại,
 * cho phép nối nhiều lời gọi liên tiếp để khai báo luật.
 *
 * Các key được sử dụng trong ràng buộc sẽ tự động trở thành key bắt buộc.
 * Khi gọi `check()` hoặc `test()`, nếu thiếu key, Rule sẽ ném lỗi
 * `"missing key"` trước khi đánh giá các điều kiện.
 *
 * Danh sách ràng buộc và tập key bắt buộc được giữ private.
 * Các getter cung cấp cách đọc lại cấu hình ràng buộc theo từng field.
 */
export class Rule {
  /** @type {Constraint[]} Danh sách các ràng buộc cần kiểm tra. */
  #constraints = [];

  /** @type {Set<string>} Tập hợp key bắt buộc phải có trong dữ liệu đầu vào. */
  #requiredKeys = new Set();
  /**
   * Thêm quy tắc kiểm tra giá trị của trường phải thuộc một enum object.
   *
   * @param {string} field - Tên trường cần kiểm tra.
   * @param {object} enumObj - Object chứa các giá trị hợp lệ.
   * @param {string} [message=`${field} không hợp lệ`] - Thông báo khi giá trị không hợp lệ.
   * @returns {this} Trả về instance hiện tại để hỗ trợ chaining.
   */
  setType(field, enumObj, message = `${field} không hợp lệ`) {
    return this.#add({
      kind: "type",
      keys: [field],
      field,
      value: enumObj,
      message,
    });
  }
  /**
   * Thêm điều kiện yêu cầu giá trị của trường phải bằng `value`.
   *
   * @param {string} field - Tên trường cần kiểm tra.
   * @param {unknown} value - Giá trị mong đợi.
   * @param {string} [message=`${field} phải là ${value}`] - Thông báo khi điều kiện không thỏa mãn.
   * @returns {this} Trả về instance hiện tại để hỗ trợ chaining.
   */
  setValueEqual(field, value, message = `${field} phải là ${value}`) {
    return this.#add({ kind: "equal", keys: [field], field, value, message });
  }

  /**
   * Thêm điều kiện yêu cầu giá trị của trường phải nằm trong danh sách cho phép.
   *
   * @param {string} field - Tên trường cần kiểm tra.
   * @param {unknown[]} list - Danh sách các giá trị được chấp nhận.
   * @param {string} [message=`${field} không nằm trong danh sách cho phép`] - Thông báo khi giá trị không nằm trong danh sách.
   * @returns {this} Trả về instance hiện tại để hỗ trợ chaining.
   */
  setValueIn(
    field,
    list,
    message = `${field} không nằm trong danh sách cho phép`,
  ) {
    return this.#add({
      kind: "in",
      keys: [field],
      field,
      value: list,
      message,
    });
  }

  /**
   * Thêm điều kiện kiểm tra tùy chỉnh.
   *
   * @template {Record<string, unknown>} T
   * @param {string[]} keys - Các key cần kiểm tra.
   * @param {(input: T) => boolean} fn - Hàm trả về true nếu điều kiện đạt.
   * @param {string} [message="Điều kiện không đạt"] - Thông báo khi điều kiện không đạt.
   * @returns {this}
   */
  setCheck(keys, fn, message = "Điều kiện không đạt") {
    return this.#add({ kind: "check", keys, fn, message });
  }

  /**
   * Lấy lại enum object đã đăng ký bằng `setType()` cho trường tương ứng.
   *
   * @param {string} field - Tên trường cần lấy enum object.
   * @returns {object | undefined} Enum object đã đăng ký, hoặc `undefined` nếu không tìm thấy.
   */
  getType(field) {
    const c = this.#constraints.find(
      (x) => x.kind === "type" && x.field === field,
    );
    if (!c)
      throw new GameError(
        ErrorCode.INVALID_ARGUMENT,
        `Không có setType cho "${field}"`,
      );
    return c.value;
  }
  /**
   * Lấy giá trị mong đợi đã đăng ký bằng `setValueEqual()` cho trường tương ứng.
   *
   * @param {string} field - Tên trường cần lấy giá trị.
   * @returns {unknown} Giá trị đã đăng ký, hoặc `undefined` nếu không tìm thấy.
   */
  getValueEqual(field) {
    const c = this.#constraints.find(
      (x) => x.kind === "equal" && x.field === field,
    );
    if (!c)
      throw new GameError(
        ErrorCode.INVALID_ARGUMENT,
        `Không có setValueEqual cho "${field}"`,
      );
    return c.value;
  }
  /**
   * Lấy danh sách giá trị đã đăng ký bằng `setValueIn()` cho trường tương ứng.
   *
   * @param {string} field - Tên trường cần lấy danh sách.
   * @returns {unknown[] | undefined} Danh sách giá trị đã đăng ký, hoặc `undefined` nếu không tìm thấy.
   */
  getValueIn(field) {
    const c = this.#constraints.find(
      (x) => x.kind === "in" && x.field === field,
    );
    if (!c)
      throw new GameError(
        ErrorCode.INVALID_ARGUMENT,
        `Không có setValueIn cho "${field}"`,
      );
    return c.value;
  }
  /**
   * Kiểm tra input theo các điều kiện đã đăng ký.
   * Ném lỗi `"missing key"` nếu thiếu trường cần thiết; nếu điều kiện
   * đầu tiên không đạt, ném lỗi với thông báo tương ứng.
   *
   * @param {Record<string, unknown>} input - Dữ liệu đầu vào cần kiểm tra.
   * @throws {Error} Nếu thiếu trường bắt buộc hoặc có điều kiện không đạt.
   */
  check(input) {
    const missing = this.#missingKey(input);
    if (missing !== null)
      throw new GameError(
        ErrorCode.INVALID_ARGUMENT,
        `missing key: ${missing}`,
      );
    const failed = this.#firstFailure(input);
    if (failed !== null) throw new GameError(ErrorCode.SELF_CHECK, failed);
  }
  /**
   * Kiểm tra input và trả về kết quả boolean, phù hợp để lọc lựa chọn.
   * Ném lỗi `"missing key"` nếu thiếu trường cần thiết vì đây là lỗi lập trình.
   *
   * @param {Record<string, unknown>} input - Dữ liệu đầu vào cần kiểm tra.
   * @returns {boolean} `true` nếu tất cả điều kiện đều đạt, ngược lại là `false`.
   * @throws {Error} Nếu thiếu trường bắt buộc.
   */
  test(input) {
    const missing = this.#missingKey(input);
    if (missing !== null)
      throw new GameError(
        ErrorCode.INVALID_ARGUMENT,
        `missing key: ${missing}`,
      );
    return this.#firstFailure(input) === null;
  }
  /**
   * Thêm một ràng buộc vào danh sách và đăng ký các key cần thiết
   * để kiểm tra ràng buộc đó.
   *
   * @param {{ keys: string[] } & Record<string, unknown>} constraint - Ràng buộc cần thêm, phải chứa danh sách `keys`.
   * @returns {this} Trả về instance hiện tại để hỗ trợ chaining.
   */
  #add(constraint) {
    this.#constraints.push(constraint);
    for (const key of constraint.keys) {
      this.#requiredKeys.add(key);
    }
    return this;
  }

  /**
   * Đọc giá trị từ input bằng đường dẫn field dạng dấu chấm.
   *
   * @param {Record<string, unknown>} input - Object dữ liệu cần đọc.
   * @param {string} field - Đường dẫn thuộc tính, phân tách bằng dấu chấm.
   * @returns {unknown} Giá trị tìm được, hoặc undefined nếu đường dẫn không tồn tại.
   */
  #read(input, field) {
    return field.split(".").reduce((obj, key) => {
      if (obj === null || typeof obj !== "object") {
        return undefined;
      }

      return /** @type {Record<string, unknown>} */ (obj)[key];
    }, /** @type {unknown} */ (input));
  }

  /**
   * Tìm key bắt buộc đầu tiên bị thiếu trong input.
   *
   * @param {Record<string, unknown>} input - Dữ liệu cần kiểm tra.
   * @returns {string | null} Key bị thiếu đầu tiên, hoặc `null` nếu không thiếu key nào.
   */
  #missingKey(input) {
    for (const key of this.#requiredKeys) {
      if (this.#read(input, key) === undefined) return key;
    }
    return null;
  }
  /**
   * Tìm thông báo lỗi của ràng buộc đầu tiên không đạt.
   *
   * @param {Record<string, unknown>} input - Dữ liệu cần kiểm tra.
   * @returns {string | null} Thông báo lỗi của ràng buộc đầu tiên không đạt,
   * hoặc `null` nếu tất cả ràng buộc đều đạt.
   */
  #firstFailure(input) {
    const failed = this.#constraints.find((c) => !this.#holds(c, input));
    return failed ? failed.message : null;
  }
  /**
   * Kiểm tra một ràng buộc có thỏa mãn với input hay không.
   *
   * @param {Constraint} c - Ràng buộc cần kiểm tra.
   * @param {Record<string, unknown>} input - Dữ liệu đầu vào.
   * @returns {boolean} `true` nếu ràng buộc đạt, ngược lại `false`.
   */
  #holds(c, input) {
    switch (c.kind) {
      case "type":
        return Object.values(c.value).includes(this.#read(input, c.field));

      case "equal":
        return this.#read(input, c.field) === c.value;

      case "in":
        return c.value.includes(this.#read(input, c.field));

      case "check":
        return c.fn(input);

      default:
        throw new Error(`Unknown constraint kind: ${c.kind}`);
    }
  }
}
