import { ApiError, apiRequest, getAuthSession } from './client.js'
import { isSameAuthSession } from './auth.js'

const accessRequests = new Map()
const SESSION_CHANGED = 'Phiên đăng nhập đã thay đổi. Hãy tải lại dữ liệu quản trị.'

function signedInSession() {
  const session = getAuthSession()
  if (!session?.accessToken) {
    throw new ApiError('Hãy đăng nhập để kiểm tra quyền quản trị.', { status: 401 })
  }
  return session
}

function assertCurrentSession(session) {
  if (!isSameAuthSession(session, getAuthSession())) {
    throw new ApiError(SESSION_CHANGED, { status: 401 })
  }
}

function accessForSession(session) {
  const key = session.refreshToken ? `refresh:${session.refreshToken}` : `access:${session.accessToken}`
  if (!accessRequests.has(key)) {
    const promise = apiRequest('/account/admin-access')
      .then((allowed) => {
        assertCurrentSession(session)
        if (typeof allowed !== 'boolean') {
          throw new ApiError('Máy chủ trả về quyền quản trị không hợp lệ.')
        }
        return allowed
      })
      .finally(() => {
        if (accessRequests.get(key) === promise) accessRequests.delete(key)
      })
    accessRequests.set(key, promise)
  }
  return accessRequests.get(key)
}

async function readAdmin(path) {
  const session = signedInSession()
  const allowed = await accessForSession(session)
  assertCurrentSession(session)
  if (!allowed) {
    throw new ApiError('Tài khoản này chưa được cấp quyền vào trang quản trị.', { status: 403 })
  }
  const result = await apiRequest(path)
  assertCurrentSession(session)
  return result
}

function textQuery(value, name) {
  if (value == null || value === '') return ''
  if (typeof value !== 'string') throw new TypeError(`${name} phải là chuỗi ký tự.`)
  return value.trim()
}

function positiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback
}

function listPath(path, { search, status, page = 1, pageSize = 20 } = {}) {
  const query = new URLSearchParams()
  const searchText = textQuery(search, 'Từ khóa')
  const statusText = textQuery(status, 'Trạng thái')
  if (searchText) query.set('search', searchText)
  if (statusText) query.set('status', statusText)
  query.set('page', String(positiveInteger(page, 1)))
  query.set('page_size', String(positiveInteger(pageSize, 20, 100)))
  return `${path}?${query}`
}

function metadataInteger(value, min) {
  return Number.isSafeInteger(value) && value >= min ? value : null
}

// Missing pagination metadata stays unknown instead of estimating totals from one page.
export function normalizeAdminPage(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.items)) {
    throw new ApiError('Máy chủ trả về danh sách quản trị không hợp lệ.')
  }
  return {
    items: value.items,
    page: metadataInteger(value.page, 1),
    pageSize: metadataInteger(value.page_size, 1),
    totalItems: metadataInteger(value.total_items, 0),
    totalPages: metadataInteger(value.total_pages, 0),
  }
}

async function readPage(path) {
  return normalizeAdminPage(await readAdmin(path))
}

async function readArray(path) {
  const value = await readAdmin(path)
  if (!Array.isArray(value)) throw new ApiError('Máy chủ trả về danh sách quản trị không hợp lệ.')
  return value
}

export const adminApi = {
  async access() {
    return accessForSession(signedInSession())
  },

  async commands() {
    const session = signedInSession()
    const commands = await apiRequest('/account/commands')
    assertCurrentSession(session)
    if (!Array.isArray(commands)) throw new ApiError('Máy chủ trả về danh sách quyền không hợp lệ.')
    return commands
  },

  accounts(options) {
    return readPage(listPath('/admin/accounts', options))
  },

  accountCount({ status } = {}) {
    const value = textQuery(status, 'Trạng thái')
    const query = value ? `?${new URLSearchParams({ status: value })}` : ''
    return readAdmin(`/admin/accounts/count${query}`)
  },

  account(id) {
    const value = typeof id === 'number' || typeof id === 'string' ? String(id) : ''
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
      return Promise.reject(new TypeError('Mã tài khoản phải là số nguyên dương.'))
    }
    return readAdmin(`/admin/accounts/${encodeURIComponent(value)}`)
  },

  roles: () => readArray('/admin/roles'),
  permissions: () => readArray('/admin/permissions'),
  journals: ({ search, page, pageSize } = {}) => readPage(listPath('/admin/journals', { search, page, pageSize })),
  notifications: ({ page, pageSize } = {}) => readPage(listPath('/admin/notifications', { page, pageSize })),
  notificationStats: () => readAdmin('/admin/notifications/stats'),
  tokenStats: () => readAdmin('/admin/tokens/stats'),
  blacklist: ({ page, pageSize } = {}) => readPage(listPath('/admin/blacklist', { page, pageSize })),
}
