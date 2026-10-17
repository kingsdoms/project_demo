/**
 * @file RuleType.js
 * @author tuanca
 */

// Phân loại rule theo hai chiều, tách riêng nhau:
//   RuleType: rule thuộc phạm vi nào (bàn, quân, ván). Quyết định input mà check nhận được.
//   RuleKind: rule làm gì (sinh nước, từ chối nước, đổi state, quyết định kết thúc ván).
// Ví dụ: "phong cấp hợp lệ" có scope PIECE và kind CHECK.
 
export const RuleType = Object.freeze({
  // Luật trên bàn: ô, đường đi, vị trí các quân.
  // Ví dụ: ô đích nằm trong bàn, đường không bị chặn, nhập thành.
  BOARD: 'board',
 
  // Luật của một quân: nhận quân và tham số của hành động.
  // Ví dụ: quân có được phong cấp không.
  PIECE: 'piece',
 
  // Luật của ván: lượt đi, bốc bài, kết thúc ván.
  // Ví dụ: ván đã kết thúc thì không cho đi, cờ chết thì hòa.
  GAME: 'game',
});



export const RuleKind = Object.freeze({
  // Sinh thêm nước ứng viên mà pattern không tạo ra.
  // Ví dụ: nhập thành, bắt qua đường.
  GENERATE: 'generate',
 
  // Từ chối nước đi. Trả về mã lỗi (ErrorCode) nếu sai, null nếu đạt.
  CHECK: 'check',
 
  // Đổi state sau khi nước đã hợp lệ. Trả về state mới.
  // Ví dụ: phong cấp, đổi lượt.
  APPLY: 'apply',
 
  // Đánh giá kết thúc ván sau nước đi. Trả về { result } nếu ván kết thúc, null nếu chưa.
  // Khác CHECK: không từ chối nước mà quyết định kết quả. Ví dụ: cờ chết thì hòa.
  OUTCOME: 'outcome',
});

export const CheckType = Object.freeze({
  // PIECE_DEFS[giá trị của arg, hoặc arg.prop][flag] === true
  DEF_FLAG: 'defFlag',
 
  // arg.row === params[param][arg.side]
  ON_RANK: 'onRank',
 
  // params[param] chứa giá trị của arg
  IN_LIST: 'inList',
 
  // Giá trị của arg (hoặc arg.prop) là true
  IS_TRUE: 'isTrue',
 
  // Giá trị của arg (hoặc arg.prop) là false
  IS_FALSE: 'isFalse',
 
  // Giá trị của arg (hoặc arg.prop) là null
  IS_NULL: 'isNull',
 
  // Giá trị của arg (hoặc arg.prop) bằng giá trị của other (hoặc other.otherProp)
  SAME: 'same',
});