/**
 * @file pieceRules.js
 * @author tuanca
 */
import { RuleSet } from "../models/RuleSet.js";
import { Rule } from "../models/Rule.js";
import { PieceType } from "../constants/PieceType.js";
import {
  PROMOTION_RANK,
  PROMOTION_TARGETS,
} from "../constants/StandardDef.js";

export const pieceRules = new RuleSet();

// Promote
pieceRules.add(
  "PROMOTE",
  new Rule()
    .setType("pieceType", PieceType)
    .setValueEqual("pieceType", PieceType.PAWN, "Chỉ tốt được phong cấp")
    .setCheck(
      ["piece"],
      ({ piece }) => piece.row === PROMOTION_RANK[piece.side],
      "Tốt chưa tới hàng cuối",
    )
    .setValueIn(
      "newPieceType",
      PROMOTION_TARGETS,
      "Không được phong thành quân này",
    ),
);
