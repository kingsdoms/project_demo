/**
 * @file gameRules.js
 * @author tuanca
 */
import { RuleSet } from "./core/models/RuleSet.js";
import { Rule } from "./core/models/Rule.js";
export const gameRules = new RuleSet();

// Chỉ bên đang tới lượt được đi quân của mình
gameRules.add(
  "TURN",
  new Rule().setCheck(
    ["piece", "turn"],
    ({ piece, turn }) => piece.side === turn,
    "Không phải lượt của bạn",
  ),
);

// Ván đã kết thúc thì không nhận nước nào nữa
gameRules.add(
  "GAME_NOT_OVER",
  new Rule().setValueEqual("state.result", null, "Ván đã kết thúc"),
);

// Tốt vừa tới hàng cuối thì phải phong trước, mọi nước khác bị chặn
gameRules.add(
  "PROMOTION_PENDING",
  new Rule().setValueEqual(
    "move.blockedByPromotion",
    false,
    "Phải phong cấp quân trước",
  ),
);
