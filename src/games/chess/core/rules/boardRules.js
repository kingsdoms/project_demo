// @ts-nocheck
/**
 * @file boardRules.js
 * @author tuanca
 */

import { Rule } from "../models/Rule.js";
export function boardRules(ruleSet) {
  // Ô đích phải nằm trong bàn
  ruleSet.add(
    "BOARD.INSIDE",
    new Rule().setValueEqual("move.inBoard", true, "Ô đích nằm ngoài bàn"),
  );

  // Ô đích phải nằm trong nước đi của quân theo luật đi quân.
  // Quân không đi chéo, không nhảy, không đi qua quân khác, trừ mã.
  ruleSet.add(
    "BOARD.PATTERN",
    new Rule().setValueEqual(
      "move.reachable",
      true,
      "Quân này không đi tới ô đó",
    ),
  );

  // Không được ăn quân cùng bên
  ruleSet.add(
    "BOARD.NOT_ALLY_TARGET",
    new Rule().setValueEqual(
      "move.targetIsAlly",
      false,
      "Không được ăn quân cùng bên",
    ),
  );

  // Sau nước đi, vua bên mình không được bị chiếu
  ruleSet.add(
    "BOARD.NOT_SELF_CHECK",
    new Rule().setValueEqual(
      "move.exposesKing",
      false,
      "Nước đi này để vua bị chiếu",
    ),
  );

  // Nhập thành: vua và xe chưa đi, giữa hai quân không có quân nào,
  // vua không đang bị chiếu, và vua không đi qua hoặc tới ô bị chiếu
  ruleSet.add(
    "BOARD.CASTLE",
    new Rule()
      .setValueEqual(
        "piece.hasMoved",
        false,
        "Vua đã đi nên không nhập thành được",
      )
      .setValueEqual(
        "rook.hasMoved",
        false,
        "Xe đã đi nên không nhập thành được",
      )
      .setValueEqual("castle.pathEmpty", true, "Giữa vua và xe còn quân")
      .setValueEqual(
        "castle.inCheck",
        false,
        "Không nhập thành khi đang bị chiếu",
      )
      .setValueEqual(
        "castle.passesAttacked",
        false,
        "Vua không được đi qua hoặc tới ô bị chiếu",
      ),
  );

  // Bắt qua đường: chỉ áp dụng cho ô vừa được tốt đối phương bỏ qua,
  // và tốt bị bắt phải vừa đi hai ô ở lượt trước
  ruleSet.add(
    "BOARD.EN_PASSANT",
    new Rule()
      .setValueEqual(
        "passant.targetMatches",
        true,
        "Bắt qua đường chỉ áp dụng cho ô vừa được bỏ qua",
      )
      .setValueEqual(
        "passant.capturedPawnJustDoubled",
        true,
        "Tốt bị bắt phải vừa đi hai ô",
      ),
  );
}
