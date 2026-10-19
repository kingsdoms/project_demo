// ui/pieceKeys.js
// Id quân đổi sau mỗi nước đi (id gồm loại, phe, hàng, cột), nên không dùng làm key của React:
// quân sẽ bị mount lại và hoạt ảnh transform không chạy.
// Hàm này gán cho mỗi quân một key ổn định bằng cách so hai danh sách quân trước và sau.
//
// Quân mới (id chưa từng thấy) được ghép với một quân vừa biến mất, cùng phe:
//   1. ưu tiên cùng loại (đi thường, nhập thành: vua ghép vua, xe ghép xe)
//   2. nếu không có thì cùng ô (phong cấp: tốt đổi thành hậu tại chỗ)
export function assignKeys(prevPieces, nextPieces, keys, counter) {
  const nextIds = new Set(nextPieces.map((p) => p.id));
  const removed = prevPieces.filter((p) => !nextIds.has(p.id));
  const result = new Map();
  let c = counter;

  for (const p of nextPieces) {
    const known = keys.get(p.id);
    if (known !== undefined) {
      result.set(p.id, known);
      continue;
    }
    let i = removed.findIndex((r) => r.side === p.side && r.type === p.type);
    if (i < 0)
      i = removed.findIndex(
        (r) => r.side === p.side && r.row === p.row && r.col === p.col,
      );
    if (i >= 0) {
      result.set(p.id, keys.get(removed[i].id));
      removed.splice(i, 1);
    } else {
      result.set(p.id, `u${c++}`);
    }
  }
  return { keys: result, counter: c };
}