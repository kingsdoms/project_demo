// @ts-nocheck
/**
 * @file CaptureMode.js
 * @author tuanca
 */

// Quy định quân có đến được ô đích (ô cuối của nước đi) hay không,
// tùy theo ô đó đang trống hay có quân. Ô có quân của mình thì không bao giờ đến được.
export const CaptureMode = Object.freeze({
  // Đến ô trống hoặc ăn quân địch. Dùng cho xe, tượng, hậu, vua, mã
  ANY: "any",
  // Chỉ đến ô có quân địch (để ăn). Dùng cho tốt đi chéo
  ONLY: "only",
  // Chỉ đến ô trống (không ăn). Dùng cho tốt đi thẳng
  NEVER: "never",
});