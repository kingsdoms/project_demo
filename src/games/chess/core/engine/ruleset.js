/**
 * @file ruleset.js
 * @author tuanca
 */
//buildRules: ghép luật gốc với extension

import { RuleSet } from "../models/RuleSet.js";
import { boardRules } from "../rules/boardRules.js";
import { gameRules } from "../rules/gameRules.js";
import { outcomeRules } from "../rules/outcomeRules.js";
import { pieceRules } from "../rules/pieceRules.js";
import { MoveKind } from "../constants/MoveKind.js";

export const ruleSet = new RuleSet();
boardRules(ruleSet);
gameRules(ruleSet);
outcomeRules(ruleSet);
pieceRules(ruleSet);

const COMMON_RULES = ["GAME.NOT_OVER", "GAME.PROMOTION_PENDING", "GAME.TURN"];

export const RULES_BY_KIND = Object.freeze({
  [MoveKind.NORMAL]: [
    ...COMMON_RULES,
    "BOARD.INSIDE",
    "BOARD.PATTERN",
    "BOARD.NOT_ALLY_TARGET",
    "BOARD.NOT_SELF_CHECK",
  ],
  [MoveKind.CASTLE]: [
    ...COMMON_RULES,
    "BOARD.INSIDE",
    "BOARD.CASTLE",
    "BOARD.NOT_SELF_CHECK",
  ],
  [MoveKind.EN_PASSANT]: [
    ...COMMON_RULES,
    "BOARD.INSIDE",
    "BOARD.EN_PASSANT",
    "BOARD.NOT_SELF_CHECK",
  ],
});

export const PROMOTE_RULES = ["PIECE.PROMOTE"];

/**
 * Kiểm tra tất cả rule được chỉ định đều đạt yêu cầu với dữ liệu đầu vào.
 *
 * Dừng ngay khi có rule không đạt. Nếu một key không tồn tại trong `ruleSet`,
 * việc gọi `test()` sẽ gây lỗi; cần bảo đảm các rule đã được đăng ký đầy đủ.
 *
 * @param {string[]} keys - Danh sách key của các rule cần kiểm tra.
 * @param {Record<string, unknown>} input - Dữ liệu đầu vào cho các rule.
 * @returns {boolean} `true` nếu tất cả rule đều đạt, ngược lại là `false`.
 */
export const passes = (keys, input) =>
  keys.every((key) => ruleSet.get(key).test(input));
