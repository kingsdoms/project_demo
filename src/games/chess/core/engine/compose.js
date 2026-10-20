/**
 * @file Game.js
 * @author tuanca
 */
//buildRules: ghép luật gốc với extension

import { RuleSet } from "../models/RuleSet.js";
import { boardRules } from "../rules/boardRules.js";
import { gameRules } from "../rules/gameRules.js";
import { outcomeRules } from "../rules/outcomeRules.js";
import { pieceRules } from "../rules/pieceRules.js";

import { MoveKind } from "../constants/MoveKind.js";

const COMMON_RULES = ["GAME.NOT_OVER", "GAME.PROMOTION_PENDING", "GAME.TURN"];

export const ruleSet = new RuleSet();
boardRules(ruleSet);
gameRules(ruleSet);
outcomeRules(ruleSet);
pieceRules(ruleSet);

export const RULES_BY_KIND = Object.freeze({
  [MoveKind.NORMAL]: [...COMMON_RULES, "BOARD.INSIDE", "BOARD.PATTERN", "BOARD.NOT_ALLY_TARGET", "BOARD.NOT_SELF_CHECK"],
  [MoveKind.CASTLE]: [...COMMON_RULES, "BOARD.INSIDE", "BOARD.CASTLE", "BOARD.NOT_SELF_CHECK"],
  [MoveKind.EN_PASSANT]: [...COMMON_RULES, "BOARD.INSIDE", "BOARD.EN_PASSANT", "BOARD.NOT_SELF_CHECK"],
});

export const PROMOTE_RULES = ["PIECE.PROMOTE"];





