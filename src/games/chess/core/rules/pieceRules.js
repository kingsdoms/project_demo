// @ts-nocheck
/**
 * @file pieceRules.js
 * @author tuanca
 */
import { Rule } from "../models/Rule.js";
import { PieceType } from "../constants/PieceType.js";
import { PROMOTION_RANK, PROMOTION_TARGETS } from "../constants/StandardDef.js";

export function pieceRules(ruleSet) {
  // Promote
  ruleSet.add(
    "PIECE.PROMOTE",
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
}
