export const SIDE_NAMES = { WHITE: 'Trắng', BLACK: 'Đen' }
export const PIECE_NAMES = {
  KING: 'Vua', QUEEN: 'Hậu', ROOK: 'Xe', BISHOP: 'Tượng', KNIGHT: 'Mã', PAWN: 'Tốt',
}
export const REASONS = {
  CHECKMATE: 'Chiếu hết',
  STALEMATE: 'Hết nước đi (hoà)',
  INSUFFICIENT_MATERIAL: 'Không đủ quân để chiếu hết',
  REPETITION: 'Lặp lại thế cờ 3 lần',
  FIFTY_MOVE: 'Luật 50 nước',
  RESIGNATION: 'Đầu hàng',
  TIMEOUT: 'Hết giờ',
  ABANDONMENT: 'Bỏ trận do mất kết nối',
  KING_LOST: 'Mất vua',
  AGREEMENT: 'Thoả thuận hoà',
}

// These dictionaries translate codes; the available content always comes from the server.
export const CHARACTERS = {
  geomancer: {
    name: 'Địa sư', icon: 'mountain', cooldown: 3,
    passive: 'Quân của bạn bám trụ khi ô dưới chân vỡ. Bước vào ô đã vỡ vẫn mất quân.',
    active: 'Làm nứt một ô trống. Ô đó sẽ vỡ ở vòng sau.',
    description: 'Nắm giữ địa hình. Biến một ô trống thành mối đe doạ ở vòng tiếp theo.',
  },
  frost_witch: {
    name: 'Phù thuỷ băng', icon: 'snowflake', cooldown: 4,
    passive: 'Quân của bạn không trượt trên băng.',
    active: 'Đóng băng một quân đối thủ, trừ vua, trong 2 vòng.',
    description: 'Làm chủ băng giá. Kìm chân quân đối thủ để mở đường tấn công.',
  },
  commander: {
    name: 'Chỉ huy', icon: 'shield', cooldown: 2,
    passive: 'Quân của bạn không bị chậm.',
    active: 'Đẩy một tốt của mình lên 1 ô trống phía trước.',
    description: 'Giữ nhịp tiến quân. Tạo lợi thế bằng một bước tiến của tốt.',
  },
}

export const CARDS = {
  swift_pawns: { name: 'Tốt nhanh', tier: 'BRONZE', icon: 'pawn', description: 'Tốt của bạn lúc nào cũng đi được 2 ô.' },
  steady_knights: { name: 'Mã vững', tier: 'BRONZE', icon: 'knight', description: 'Mã của bạn đi thêm được 1 ô thẳng, không ăn quân.' },
  sure_footed: { name: 'Vững chân', tier: 'BRONZE', icon: 'shield', description: 'Quân của bạn không trượt băng và không bị chậm.' },
  frostbite: { name: 'Sương giá', tier: 'SILVER', icon: 'snowflake', description: 'Xe, Tượng và Hậu của đối thủ bị chậm trong 3 vòng.' },
  ice_trap: { name: 'Bẫy băng', tier: 'SILVER', icon: 'snowflake', description: 'Tạo 2 ô băng trước mặt tốt đối thủ, tồn tại 4 vòng.' },
  rook_guard: { name: 'Xe hộ vệ', tier: 'SILVER', icon: 'rook', description: 'Xe của bạn đi và ăn thêm được 1 ô chéo.' },
  spear_pawns: { name: 'Tốt giáo', tier: 'GOLD', icon: 'pawn', description: 'Tốt của bạn ăn được quân ngay trước mặt.' },
  royal_leap: { name: 'Vua nhảy', tier: 'GOLD', icon: 'king', description: 'Vua của bạn nhảy được như Mã.' },
  tremor: { name: 'Dư chấn', tier: 'GOLD', icon: 'mountain', description: 'Làm nứt 2 ô ở nửa bàn đối thủ. Các ô sẽ vỡ ở vòng sau.' },
}

export const WEATHER = {
  earthquake: { name: 'Động đất', icon: 'mountain', description: '4 ô đối xứng bị nứt, vòng sau vỡ và loại quân đang đứng trên. Ô vỡ tồn tại 3 vòng, không thể đi qua.' },
  cold_snap: { name: 'Rét đậm', icon: 'snowflake', description: '6 ô lạnh ở 4 hàng giữa tồn tại 3 vòng. Quân bước vào bị chậm 2 vòng: Xe, Tượng, Hậu đi tối đa 2 ô; Tốt mất nước đi 2 ô.' },
  blizzard: { name: 'Bão tuyết', icon: 'snowflake', description: '6 ô băng ở 4 hàng giữa tồn tại 3 vòng. Quân bước vào trượt 1 ô theo hướng ngẫu nhiên.' },
}

export const EFFECTS = {
  cracked: { name: 'Nứt', icon: 'mountain', description: 'Ô sẽ vỡ ở vòng sau.' },
  broken: { name: 'Vỡ', icon: 'mountain', description: 'Không thể đi qua. Quân bước vào sẽ bị loại.' },
  cold: { name: 'Lạnh', icon: 'snowflake', description: 'Quân bước vào bị chậm.' },
  ice: { name: 'Băng', icon: 'snowflake', description: 'Quân bước vào trượt thêm 1 ô.' },
  slowed: { name: 'Chậm', icon: 'timer', description: 'Xe, Tượng, Hậu đi tối đa 2 ô; Tốt mất nước đi 2 ô.' },
  frozen: { name: 'Đóng băng', icon: 'snowflake', description: 'Quân đang bị đóng băng, không thể di chuyển.' },
}

export function modeName(mode) {
  return { STANDARD: 'Cờ vua tiêu chuẩn', PRACTICE: 'Đánh với máy', EXTENDED: 'Chế độ mở rộng' }[mode] || mode
}

export function describeCode(code) {
  if (code == null) return 'Chưa chọn'
  return CHARACTERS[code]?.name || CARDS[code]?.name || WEATHER[code]?.name || EFFECTS[code]?.name || SIDE_NAMES[code] || PIECE_NAMES[code] || REASONS[code] || String(code)
}
