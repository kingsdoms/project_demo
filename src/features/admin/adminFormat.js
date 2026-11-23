// Hàm thuần dùng chung cho bảng quản trị. Không đụng tới window để render SSR an toàn.

const SECRET_PATTERNS = [
  [/Bearer\s+[^\s]+/gi, 'Bearer [đã ẩn]'],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\b/g, '[token đã ẩn]'],
]

/** Giá trị đầu tiên là chuỗi khác rỗng hoặc số hữu hạn; ngược lại trả `fallback`. */
export function pickText(values, fallback = '—') {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (typeof value === 'string' && value.trim()) {
      return SECRET_PATTERNS.reduce((text, [pattern, mask]) => text.replace(pattern, mask), value.trim())
    }
  }
  return fallback
}

export const text = (...values) => pickText(values)

export function dateLabel(value) {
  if (value === undefined || value === null || value === '' || value === 0) return '—'
  const date = new Date(typeof value === 'number' && value < 100_000_000_000 ? value * 1000 : value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

export function numberLabel(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('vi-VN') : '—'
}

export function collection(value) {
  const list = Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : []
  return list.filter((item) => item !== null && item !== undefined)
}

const pad = (value) => String(value).padStart(2, '0')

/**
 * `datetime-local` ("2026-12-31T23:59") → RFC 3339 có offset của máy người dùng.
 * Trả `undefined` khi trống hoặc không hợp lệ.
 */
export function toRfc3339(local, offsetMinutes) {
  if (typeof local !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(local)) return undefined
  const date = new Date(local)
  if (Number.isNaN(date.getTime())) return undefined
  const offset = offsetMinutes ?? -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  const seconds = local.length === 16 ? `${local}:00` : local
  return `${seconds}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/** "1, 2 ,x, 3" → [1, 2, 3]; trả null nếu có phần tử không phải số nguyên dương. */
export function parseIdList(input) {
  const parts = String(input ?? '').split(/[\s,;]+/).filter(Boolean)
  if (!parts.length) return []
  const ids = parts.map(Number)
  return ids.every((id) => Number.isSafeInteger(id) && id > 0) ? [...new Set(ids)] : null
}

export function mmss(seconds) {
  const total = Math.max(0, Math.floor(seconds))
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

/** Chuẩn hoá phần tử role/permission thành mã chuỗi. */
export function codeOf(item) {
  if (typeof item === 'string') return item
  return pickText([item?.role_code, item?.permission_code, item?.code, item?.type_code, item?.name], '')
}

/** Danh sách quyền của một role, bất kể server trả mảng chuỗi hay mảng object. */
export function rolePermissions(role) {
  const raw = role?.permissions ?? role?.permission_codes ?? []
  return new Set((Array.isArray(raw) ? raw : []).map(codeOf).filter(Boolean))
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim())
}

export function isIp(value) {
  const v = String(value ?? '').trim()
  if (/^(\d{1,3})(\.\d{1,3}){3}$/.test(v)) return v.split('.').every((n) => Number(n) <= 255)
  return /^[0-9a-f:]+$/i.test(v) && v.includes(':')
}

/** Hiển thị đối tượng thống kê bất kỳ thành các cặp nhãn/giá trị số. */
export function statEntries(value) {
  if (typeof value === 'number') return [['Tổng', value]]
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value)) {
    return value.map((item, index) => [
      pickText([item?.type_code, item?.type, item?.name, item?.label, item?.status_code], `#${index + 1}`),
      item?.count ?? item?.total ?? item?.value,
    ]).filter(([, count]) => typeof count === 'number')
  }
  return Object.entries(value).filter(([, count]) => typeof count === 'number')
}

const LABELS = {
  total: 'Tổng', total_items: 'Tổng', active: 'Đang hoạt động', expired: 'Hết hạn', revoked: 'Đã thu hồi',
  unread: 'Chưa đọc', read: 'Đã đọc', public: 'Công khai', private: 'Riêng', refresh: 'Refresh token',
  access: 'Access token', sessions: 'Phiên', notifications: 'Thông báo',
}

export function statLabel(key) {
  const normalized = String(key).toLowerCase()
  return LABELS[normalized] ?? String(key).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

const STATUS = {
  ACTIVE: ['Hoạt động', 'success'],
  INACTIVE: ['Chưa kích hoạt', 'warning'],
  PENDING: ['Đang chờ', 'warning'],
  BANNED: ['Bị khoá', 'error'],
  DELETE: ['Chờ xoá', 'neutral'],
  DELETED: ['Đã xoá', 'neutral'],
  ENABLE: ['Bật', 'success'],
  ENABLED: ['Bật', 'success'],
  DISABLE: ['Tắt', 'neutral'],
  DISABLED: ['Tắt', 'neutral'],
}

export const ACCOUNT_STATUSES = ['ACTIVE', 'INACTIVE', 'BANNED', 'DELETE']

/** `[nhãn, tone]` cho một mã trạng thái; mã lạ giữ nguyên, rỗng thành "Không rõ". */
export function statusInfo(code) {
  return STATUS[String(code ?? '').toUpperCase()] ?? [code ? String(code) : 'Không rõ', 'neutral']
}

export function statusName(code) {
  return statusInfo(code)[0]
}
