/**
 * @file outcomeRules.js
 * @author tuanca
 */

import { RuleSet } from "./core/models/RuleSet.js";
import { Rule } from "./core/models/Rule.js";
export const outcomeRules = new RuleSet();

outcomeRules.add(
  "checkmate",
  new Rule()
    .setValueEqual("position.inCheck", true)
    .setValueEqual("position.hasLegalMove", false),
);

// Bên tới lượt không bị chiếu nhưng không còn nước hợp lệ: hòa
outcomeRules.add(
  "stalemate",
  new Rule()
    .setValueEqual("position.inCheck", false)
    .setValueEqual("position.hasLegalMove", false),
);

// Không bên nào còn đủ quân để chiếu hết: hòa. Engine tự xác định trường hợp này.
outcomeRules.add(
  "insufficientMaterial",
  new Rule().setValueEqual("position.insufficientMaterial", true),
);
