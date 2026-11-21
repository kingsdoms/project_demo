// Presets limit both the UCI skill setting and local thinking resources.
// These are product difficulty levels, not calibrated Elo ratings.
export const BOT_LEVELS = Object.freeze([
  Object.freeze({ key: 'beginner', label: 'Mới bắt đầu', description: 'Tìm nước ngắn, làm quen cách đi quân.', skill: 0, depth: 2, moveTime: 150 }),
  Object.freeze({ key: 'easy', label: 'Dễ', description: 'Phù hợp luyện quan sát và giữ quân.', skill: 3, depth: 5, moveTime: 300 }),
  Object.freeze({ key: 'medium', label: 'Trung bình', description: 'Cân bằng giữa suy nghĩ và tốc độ.', skill: 7, depth: 9, moveTime: 600 }),
  Object.freeze({ key: 'hard', label: 'Khó', description: 'Tính toán sâu hơn, ít bỏ lỡ cơ hội.', skill: 11, depth: 13, moveTime: 1000 }),
  Object.freeze({ key: 'expert', label: 'Chuyên gia', description: 'Thử thách chiến thuật và kế hoạch.', skill: 16, depth: 18, moveTime: 1600 }),
  Object.freeze({ key: 'master', label: 'Bậc thầy', description: 'Skill tối đa trong ngân sách của thiết bị.', skill: 20, depth: 22, moveTime: 2400 }),
])

export function getBotLevel(level = 'medium') {
  const key = typeof level === 'string' ? level : level?.key
  return BOT_LEVELS.find((item) => item.key === key) || BOT_LEVELS[2]
}
