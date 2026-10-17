/**
 * @file RuleDefs.js
 * @author tuanca
 */

import { RuleType, CheckType } from "./RuleType.js";

const P = (obj) => Object.freeze(obj);

// Cách đọc file này:
// - Mỗi mục là một luật cờ vua. Thứ tự khai báo là thứ tự kiểm tra.
// - Luật không tự tính sự kiện. Engine tính sẵn các fact rồi truyền vào theo đúng thứ tự trong args.
//   Luật chỉ khai báo fact nào phải đúng, sai thì throw error ghi trong trường error.
// - prop là thuộc tính của giá trị. Ví dụ { arg: "piece", prop: "side" } nghĩa là piece.side.
//
// Fact engine phải cung cấp:
//   turn:     "w" hoặc "b", bên đang tới lượt
//   state:    { result, enPassantTarget, pendingPromotion }
//   piece:    quân đang đi, lấy từ state.pieces
//   move:     { inBoard, reachable, targetIsAlly, exposesKing, blockedByPromotion }
//             inBoard: ô đích nằm trong bàn
//             reachable: ô đích nằm trong nước đi theo PieceMoveDefs, đường bị chặn đã được loại
//             targetIsAlly: ô đích có quân cùng bên
//             exposesKing: sau nước đi, vua bên mình bị chiếu. Engine tính bằng cách thử nước trên bản sao
//             blockedByPromotion: đang chờ phong cấp và nước này không phải PROMOTE
//   rook:     xe dùng cho nhập thành, null nếu không tìm thấy
//   castle:   { pathEmpty, passesAttacked, inCheck }
//             passesAttacked: ô vua đi qua hoặc ô đích bị chiếu
//   passant:  { targetMatches, capturedPawnJustDoubled }
//   position: { inCheck, hasLegalMove, insufficientMaterial }, trạng thái bên tới lượt sau nước đi

export const RULE_DEFS = P({
  // ===== Luật của ván =====

  // Chỉ bên đang tới lượt được đi quân của mình.
  TURN: P({
    scope: RuleType.GAME,
    check: P({
      args: P(["piece", "turn"]),
      conditions: P([
        P({
          type: CheckType.SAME,
          arg: "piece",
          prop: "side",
          other: "turn",
          error: "Không phải lượt của bạn",
        }),
      ]),
    }),
  }),

  // Ván đã kết thúc thì không nhận nước nào nữa.
  GAME_NOT_OVER: P({
    scope: RuleType.GAME,
    check: P({
      args: P(["state"]),
      conditions: P([
        P({
          type: CheckType.IS_NULL,
          arg: "state",
          prop: "result",
          error: "Ván đã kết thúc",
        }),
      ]),
    }),
  }),

  // Tốt vừa tới hàng cuối thì phải chọn quân phong trước. Mọi nước khác bị chặn cho tới khi phong xong.
  PROMOTION_PENDING: P({
    scope: RuleType.GAME,
    check: P({
      args: P(["move"]),
      conditions: P([
        P({
          type: CheckType.IS_FALSE,
          arg: "move",
          prop: "blockedByPromotion",
          error: "Phải phong cấp quân trước",
        }),
      ]),
    }),
  }),

  // ===== Luật trên bàn =====

  // Ô đích phải nằm trong bàn.
  IN_BOARD: P({
    scope: RuleType.BOARD,
    check: P({
      args: P(["move"]),
      conditions: P([
        P({
          type: CheckType.IS_TRUE,
          arg: "move",
          prop: "inBoard",
          error: "Ô đích nằm ngoài bàn",
        }),
      ]),
    }),
  }),

  // Ô đích phải nằm trong nước đi của quân theo luật đi quân (PieceMoveDefs).
  // Quân không được đi chéo, đi nhảy hay đi qua quân khác, trừ mã.
  PATTERN: P({
    scope: RuleType.BOARD,
    check: P({
      args: P(["move"]),
      conditions: P([
        P({
          type: CheckType.IS_TRUE,
          arg: "move",
          prop: "reachable",
          error: "Quân này không đi tới ô đó",
        }),
      ]),
    }),
  }),

  // Không được ăn quân cùng bên.
  NOT_ALLY_TARGET: P({
    scope: RuleType.BOARD,
    check: P({
      args: P(["move"]),
      conditions: P([
        P({
          type: CheckType.IS_FALSE,
          arg: "move",
          prop: "targetIsAlly",
          error: "Không được ăn quân cùng bên",
        }),
      ]),
    }),
  }),

  // Sau nước đi, vua bên mình không được bị chiếu.
  NOT_SELF_CHECK: P({
    scope: RuleType.BOARD,
    check: P({
      args: P(["move"]),
      conditions: P([
        P({
          type: CheckType.IS_FALSE,
          arg: "move",
          prop: "exposesKing",
          error: "Nước đi này để vua bị chiếu",
        }),
      ]),
    }),
  }),

  // Nhập thành: vua và xe chưa đi, giữa hai quân không có quân nào,
  // vua không đang bị chiếu, và vua không đi qua hoặc tới ô bị chiếu.
  // Engine chỉ chạy luật này khi vua đi ngang hai ô và tìm được xe.
  CASTLE: P({
    scope: RuleType.BOARD,
    check: P({
      args: P(["piece", "rook", "castle"]),
      conditions: P([
        P({
          type: CheckType.IS_FALSE,
          arg: "piece",
          prop: "hasMoved",
          error: "Vua đã đi nên không nhập thành được",
        }),
        P({
          type: CheckType.IS_FALSE,
          arg: "rook",
          prop: "hasMoved",
          error: "Xe đã đi nên không nhập thành được",
        }),
        P({
          type: CheckType.IS_TRUE,
          arg: "castle",
          prop: "pathEmpty",
          error: "Giữa vua và xe còn quân",
        }),
        P({
          type: CheckType.IS_FALSE,
          arg: "castle",
          prop: "inCheck",
          error: "Không nhập thành khi đang bị chiếu",
        }),
        P({
          type: CheckType.IS_FALSE,
          arg: "castle",
          prop: "passesAttacked",
          error: "Vua không được đi qua hoặc tới ô bị chiếu",
        }),
      ]),
    }),
  }),

  // Bắt qua đường: chỉ áp dụng cho ô vừa được tốt đối phương bỏ qua,
  // và tốt bị bắt phải vừa đi hai ô ở lượt trước.
  // Engine chỉ chạy luật này khi tốt đi chéo tới một ô trống.
  EN_PASSANT: P({
    scope: RuleType.BOARD,
    check: P({
      args: P(["passant"]),
      conditions: P([
        P({
          type: CheckType.IS_TRUE,
          arg: "passant",
          prop: "targetMatches",
          error: "Bắt qua đường chỉ áp dụng cho ô vừa được bỏ qua",
        }),
        P({
          type: CheckType.IS_TRUE,
          arg: "passant",
          prop: "capturedPawnJustDoubled",
          error: "Tốt bị bắt phải vừa đi hai ô",
        }),
      ]),
    }),
  }),

  // ===== Luật của quân =====

  // Chỉ tốt được phong cấp. Quân được chọn phải nằm trong targets.
  // Tốt phải ở hàng cuối của bên mình, lastRank khớp với side của quân.
  PROMOTE: P({
    scope: RuleType.PIECE,
    params: P({
      targets: P(["queen", "rook", "bishop", "knight"]),
      lastRank: P({ w: 0, b: 7 }),
    }),
    allowed: P({
      args: P(["pieceType"]),
      conditions: P([
        P({ type: CheckType.DEF_FLAG, arg: "pieceType", flag: "canPromote" }),
      ]),
      options: "targets",
    }),
    check: P({
      args: P(["piece", "newPieceType"]),
      conditions: P([
        P({
          type: CheckType.DEF_FLAG,
          arg: "piece",
          prop: "type",
          flag: "canPromote",
          error: "Chỉ tốt được phong cấp",
        }),
        P({
          type: CheckType.ON_RANK,
          arg: "piece",
          param: "lastRank",
          error: "Tốt chưa tới hàng cuối",
        }),
        P({
          type: CheckType.IN_LIST,
          arg: "newPieceType",
          param: "targets",
          error: "Không được phong thành quân này",
        }),
      ]),
    }),
  }),

  // ===== Kết thúc ván =====
  // Các luật này không từ chối nước. Engine xét sau mỗi nước.
  // Nếu điều kiện đúng thì ván kết thúc với result tương ứng.
  // Bên thắng là bên không tới lượt, engine tự xác định.

  // Bên tới lượt bị chiếu và không còn nước hợp lệ nào: thua.
  CHECKMATE: P({
    scope: RuleType.GAME,
    outcome: P({
      args: P(["position"]),
      conditions: P([
        P({ type: CheckType.IS_TRUE, arg: "position", prop: "inCheck" }),
        P({ type: CheckType.IS_FALSE, arg: "position", prop: "hasLegalMove" }),
      ]),
      result: "checkmate",
    }),
  }),

  // Bên tới lượt không bị chiếu nhưng không còn nước hợp lệ nào: hòa.
  STALEMATE: P({
    scope: RuleType.GAME,
    outcome: P({
      args: P(["position"]),
      conditions: P([
        P({ type: CheckType.IS_FALSE, arg: "position", prop: "inCheck" }),
        P({ type: CheckType.IS_FALSE, arg: "position", prop: "hasLegalMove" }),
      ]),
      result: "stalemate",
    }),
  }),

  // Không bên nào còn đủ quân để chiếu hết: hòa.
  // Engine xác định trường hợp này: vua với vua, vua với một mã hoặc một tượng khi đối phương chỉ có vua,
  // và vua với tượng cùng màu ô so với vua với tượng cùng màu ô.
  INSUFFICIENT_MATERIAL: P({
    scope: RuleType.GAME,
    outcome: P({
      args: P(["position"]),
      conditions: P([
        P({ type: CheckType.IS_TRUE, arg: "position", prop: "insufficientMaterial" }),
      ]),
      result: "insufficientMaterial",
    }),
  }),
});