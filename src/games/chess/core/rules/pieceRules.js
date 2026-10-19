/**
 * @file pieceRules.js
 * @author tuanca
 */
import { RuleSet } from "../models/RuleSet.js";
import { Rule } from "../models/Rule.js";
import { PieceType } from "../constants/PieceType.js";
import { Side } from "../constants/Side.js";

// các quân được phép phong cấp
const PROMOTE_TARGETS = Object.freeze([
  PieceType.QUEEN,
  PieceType.ROOK,
  PieceType.BISHOP,
  PieceType.KNIGHT,
]);

//Tọa độ logic: Trắng luôn đi từ hàng 6 về hàng 0, Đen đi từ hàng 1 về hàng 7.
const LAST_RANK = Object.freeze({
  [Side.WHITE]: 0,
  [Side.BLACK]: 7,
});

export const pieceRules = new RuleSet();

// Promote
pieceRules.add(
  "PROMOTE",
  new Rule()
    .setType("pieceType", PieceType)
    .setValueEqual("pieceType", PieceType.PAWN, "Chỉ tốt được phong cấp")
    .setCheck(
      ["piece"],
      ({ piece }) => piece.row === LAST_RANK[piece.side],
      "Tốt chưa tới hàng cuối",
    )
    .setValueIn(
      "newPieceType",
      PROMOTE_TARGETS,
      "Không được phong thành quân này",
    ),
);
