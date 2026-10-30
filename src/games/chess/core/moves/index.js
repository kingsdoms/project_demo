/**
 * @file index.js
 * @author tuanca
 */
import { MoveKind } from "../constants/MoveKind.js";
import { castle } from "./castle.js";
import { enPassant } from "./enPassant.js";
import { normal } from "./normal.js";

export { validate } from "./validate.js";
export { validatePromotion, applyPromotion } from "./promote.js";

/**
 * @typedef {import("../../utils/GameError.js").GameError} GameError
 * @typedef {import("../models/Game.js").Game} Game
 * @typedef {import("../models/Piece.js").Piece} Piece
 * @typedef {import("../models/Board.js").Board} Board
 * @typedef {import("../constants/PieceType.js").PieceTypeValue} PieceTypeValue
 * @typedef {import("../constants/MoveKind.js").MoveKindValue} MoveKindValue
 */

/**
 * Toạ độ một ô trên bàn cờ.
 *
 * @typedef {Object} Position
 * @property {number} row - Hàng của ô.
 * @property {number} col - Cột của ô.
 */

/**
 * Liệt kê các ô đích mà loại nước đi này có thể áp dụng cho quân cờ.
 * Chỉ là tập ứng viên (có thể nằm ngoài bàn hoặc chưa hợp lệ), tính hợp lệ
 * do `matches` và `checks` quyết định.
 *
 * @callback CandidatesFn
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ cần liệt kê ô đích.
 * @returns {Position[]} Các ô đích ứng viên, có thể rỗng nếu loại nước đi không áp dụng cho quân này.
 */

/**
 * Kiểm tra một loại nước đi có áp dụng cho nước đi được yêu cầu không.
 *
 * @callback MatchesFn
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ được di chuyển.
 * @param {number} row - Hàng của ô đích.
 * @param {number} col - Cột của ô đích.
 * @returns {boolean} `true` nếu loại nước đi này áp dụng được.
 */

/**
 * Thực hiện nước đi và trả về trạng thái ván cờ sau nước đi.
 * Hàm thuần: `game` truyền vào không bị thay đổi, nên `kingSafe` có thể
 * dùng nó để giả lập nước đi.
 *
 * @callback ApplyFn
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ được di chuyển.
 * @param {number} row - Hàng của ô đích.
 * @param {number} col - Cột của ô đích.
 * @returns {Game} Game mới sau nước đi.
 */

/**
 * Tính các dữ kiện của nước đi. Mỗi dữ kiện là một hàm, `validate` bọc bằng
 * `lazy` nên chỉ tính khi check đọc tới và nhớ kết quả (`ctx.f.<tên>`).
 *
 * @callback FactsFn
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ được di chuyển.
 * @param {number} row - Hàng của ô đích.
 * @param {number} col - Cột của ô đích.
 * @returns {Record<string, () => unknown>} Các dữ kiện tính lười theo tên.
 */

/**
 * Ngữ cảnh tối thiểu mà mọi check đều có.
 *
 * @typedef {Object} CheckContext
 * @property {Game} game - Trạng thái ván cờ hiện tại.
 * @property {Piece} piece - Quân cờ đang được kiểm tra.
 */

/**
 * Ngữ cảnh của một nước đi, truyền cho các check trong `Move.checks`.
 *
 * @typedef {Object} MoveContext
 * @property {Game} game - Trạng thái ván cờ hiện tại.
 * @property {Piece} piece - Quân cờ được di chuyển.
 * @property {Move} move - Loại nước đi đang được kiểm tra.
 * @property {number} row - Hàng của ô đích.
 * @property {number} col - Cột của ô đích.
 * @property {Record<string, any>} f - Dữ kiện tính lười, sinh từ `Move.facts`.
 */

/**
 * Ngữ cảnh của hành động phong cấp.
 *
 * @typedef {Object} PromotionContext
 * @property {Game} game - Trạng thái ván cờ hiện tại.
 * @property {Piece} piece - Tốt được chọn để phong cấp.
 * @property {{ newType: PieceTypeValue }} f - Loại quân muốn phong thành.
 */

/**
 * Một check của nước đi: `null` nếu qua, `GameError` nếu vi phạm.
 *
 * @typedef {(ctx: MoveContext) => GameError | null} GameCheck
 */

/**
 * Một loại nước đi.
 *
 * @typedef {Object} Move
 * @property {MoveKindValue} kind - Định danh loại nước đi, dùng cho `extendMoves`.
 * @property {MatchesFn} matches - Loại nước đi này có áp dụng cho nước đi được yêu cầu không.
 * @property {CandidatesFn} candidates - Các ô đích ứng viên của loại nước đi này.
 * @property {FactsFn} [facts] - (Tuỳ chọn) Dữ kiện tính lười cho các check.
 * @property {GameCheck[]} checks - Check riêng của loại nước đi, thứ tự rẻ → đắt.
 * @property {ApplyFn} apply - Thực hiện nước đi, trả về game mới.
 */

/**
 * Bộ nước đi của luật gốc.
 * Thứ tự quan trọng: nước đặc biệt trước, normal luôn cuối vì matches luôn true.
 *
 * @type {Move[]}
 */
export const MOVES = [castle, enPassant, normal];

/**
 * Tìm loại nước đi phù hợp với quân cờ và ô đích trong danh sách nước đi.
 * Duyệt theo thứ tự, trả về loại đầu tiên có `matches` là `true`.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ cần di chuyển.
 * @param {number} row - Hàng đích.
 * @param {number} col - Cột đích.
 * @param {Move[]} [moves=MOVES] - Bộ nước đi được sử dụng.
 * @returns {Move | undefined} Loại nước đi phù hợp, hoặc `undefined` nếu không có.
 */
export const findMove = (game, piece, row, col, moves = MOVES) =>
  moves.find((m) => m.matches(game, piece, row, col));

/**
 * Tạo bộ nước đi của mode mở rộng từ bộ gốc:
 * - move cùng kind thì thay thế bản gốc
 * - move kind mới thì chèn trước normal
 *
 * @param {Move[]} base - Bộ nước đi gốc, ví dụ [castle, enPassant, normal].
 * @param {...Move} overrides - Các move của mode mở rộng. Mỗi move được so khớp
 *   với bản gốc qua `kind`.
 * @returns {Move[]} Mảng move mới, `base` không bị thay đổi. `normal` vẫn đứng
 *   cuối để làm trường hợp mặc định.
 * @throws {Error} Nếu `base` không chứa move kind NORMAL.
 *
 * @example
 * // Thay castle bằng bản riêng, thêm move mới `teleport` (kind đã khai báo
 * // trong MoveKind) và chèn trước normal
 * const moves = extendMoves(MOVES, customCastle, teleport);
 * // => [customCastle, enPassant, teleport, normal]
 */
export function extendMoves(base, ...overrides) {
  /** @type {Map<MoveKindValue, Move>} */
  const byKind = new Map();
  for (const m of base) byKind.set(m.kind, m);

  /** @type {Move[]} */
  const added = [];
  for (const o of overrides) {
    if (byKind.has(o.kind)) byKind.set(o.kind, o);
    else added.push(o);
  }

  const normalMove = byKind.get(MoveKind.NORMAL);
  if (!normalMove) {
    throw new Error("extendMoves: base phải chứa move kind NORMAL");
  }
  const rest = [...byKind.values()].filter((m) => m !== normalMove);
  return [...rest, ...added, normalMove];
}