// @ts-nocheck
/**
 * @file lazy.js
 * @author tuanca
 */
 
// Gói các hàm tính giá trị thành object có getter: mỗi giá trị chỉ được tính khi có người đọc,
// và chỉ tính một lần. Dùng cho input của rule, để sự thật tốn kém (ví dụ move.exposesKing)
// không bị tính trên nước mà rule rẻ hơn đã loại.
//
//   const facts = lazy({ a: () => tinhA(), b: () => tinhB() });
//   facts.a;  // lúc này mới gọi tinhA, lần đọc sau dùng lại kết quả
export function lazy(factories) {
  const out = {};
  for (const [key, fn] of Object.entries(factories)) {
    let done = false;
    let value;
    Object.defineProperty(out, key, {
      enumerable: true,
      get() {
        if (!done) {
          value = fn();
          done = true;
        }
        return value;
      },
    });
  }
  return out;
}