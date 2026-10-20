// @ts-nocheck
/**
 * @file gameRules.js
 * @author tuanca
 */
import { Rule } from "../models/Rule.js";
export function gameRules(ruleSet) {
  // Chỉ bên đang tới lượt được đi quân của mình
  ruleSet.add(
    "GAME.TURN",
    new Rule().setCheck(
      ["piece", "turn"],
      ({ piece, turn }) => piece.side === turn,
      "Không phải lượt của bạn",
    ),
  );

  // Ván đã kết thúc thì không nhận nước nào nữa
  ruleSet.add(
    "GAME.NOT_OVER",
    new Rule().setValueEqual("state.result", null, "Ván đã kết thúc"),
  );

  // Tốt vừa tới hàng cuối thì phải phong trước, mọi nước khác bị chặn
  ruleSet.add(
    "GAME.PROMOTION_PENDING",
    new Rule().setValueEqual(
      "move.blockedByPromotion",
      false,
      "Phải phong cấp quân trước",
    ),
  );
}
