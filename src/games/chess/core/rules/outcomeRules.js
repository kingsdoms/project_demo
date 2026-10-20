// @ts-nocheck
/**
 * @file outcomeRules.js
 * @author tuanca
 */

import { Rule } from "../models/Rule.js";
import { OutcomeType } from "../constants/OutcomeType.js";

export function outcomeRules(ruleSet) {
  ruleSet.add(
    OutcomeType.CHECKMATE,
    new Rule()
      .setValueEqual("position.inCheck", true)
      .setValueEqual("position.hasLegalMove", false),
  );

  // Bên tới lượt không bị chiếu nhưng không còn nước hợp lệ: hòa
  ruleSet.add(
    OutcomeType.STALEMATE,
    new Rule()
      .setValueEqual("position.inCheck", false)
      .setValueEqual("position.hasLegalMove", false),
  );

  // Không bên nào còn đủ quân để chiếu hết: hòa. Engine tự xác định trường hợp này.
  ruleSet.add(
    OutcomeType.INSUFFICIENT_MATERIAL,
    new Rule().setValueEqual("position.insufficientMaterial", true),
  );
}
