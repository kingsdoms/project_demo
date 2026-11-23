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
  commandList: ({ search, page, pageSize } = {}) => readPage(listPath('/admin/commands', { search, page, pageSize })),
  accountOauth: (id) => readArray(`/admin/accounts/${accountId(id)}/oauth`),

  // --- TOTP (không cần cửa sổ verify) ---
  totpSetup: ({ account, renew = false } = {}) => writeAdmin('/admin/totp/setup', 'POST', {
    ...(account ? { account } : {}), renew: Boolean(renew),
  }),
  async totpConfirm({ code, recovery_code } = {}) {
    const result = await writeAdmin('/admin/totp/confirm', 'POST', {
      code: String(code ?? '').trim(), ...(recovery_code ? { recovery_code } : {}),
    })
    // Confirm thành công cũng mở cửa sổ 10 phút như verify.
    markTotpVerified(600)
    return result
  },
  async totpVerify(code) {
    const result = await writeAdmin('/admin/totp/verify', 'POST', { code: String(code ?? '').trim() })
    if (result?.valid) markTotpVerified(result.expires_in)
    return result
  },
  totpRemaining,

  // --- Thao tác ghi (cần TOTP đã verify trong 10 phút) ---
  updateAccount: (id, fields) => writeAdmin(`/admin/accounts/${accountId(id)}`, 'PATCH', fields),
  verifyAvatar: (id, verified = true) => writeAdmin(`/admin/accounts/${accountId(id)}/verify-avatar`, 'POST', { verified }),
  grantRole: (id, role) => writeAdmin(`/admin/accounts/${accountId(id)}/roles/${code(role)}`, 'PUT'),
  revokeRole: (id, role) => writeAdmin(`/admin/accounts/${accountId(id)}/roles/${code(role)}`, 'DELETE'),
  revokeSessions: (id) => writeAdmin(`/admin/accounts/${accountId(id)}/sessions`, 'DELETE'),
  purgeDeleted: () => writeAdmin('/admin/accounts/purge-deleted', 'POST'),
  saveRole: (role, { description, admin_portal_access } = {}) => writeAdmin(`/admin/roles/${code(role)}`, 'PUT', {
    ...(description !== undefined ? { description } : {}),
    ...(admin_portal_access !== undefined ? { admin_portal_access: Boolean(admin_portal_access) } : {}),
  }),
  deleteRole: (role) => writeAdmin(`/admin/roles/${code(role)}`, 'DELETE'),
  grantPermission: (role, perm) => writeAdmin(`/admin/roles/${code(role)}/permissions/${code(perm)}`, 'PUT'),
  revokePermission: (role, perm) => writeAdmin(`/admin/roles/${code(role)}/permissions/${code(perm)}`, 'DELETE'),
  saveCommand: (command, body) => writeAdmin(`/admin/commands/${code(command)}`, 'PUT', body),
  deleteCommand: (command) => writeAdmin(`/admin/commands/${code(command)}`, 'DELETE'),
  grantCommandRole: (command, role) => writeAdmin(`/admin/commands/${code(command)}/roles/${code(role)}`, 'PUT'),
  revokeCommandRole: (command, role) => writeAdmin(`/admin/commands/${code(command)}/roles/${code(role)}`, 'DELETE'),
  createNotification: (body) => writeAdmin('/admin/notifications', 'POST', body),
  deleteNotification: (id) => writeAdmin(`/admin/notifications/${accountId(id)}`, 'DELETE'),
  addBlacklist: (body) => writeAdmin('/admin/blacklist', 'POST', body),
  removeBlacklist: (id) => writeAdmin(`/admin/blacklist/${accountId(id)}`, 'DELETE'),
  clean: () => writeAdmin('/admin/clean', 'POST'),
}

function accountId(id) {
  const value = typeof id === 'number' || typeof id === 'string' ? String(id) : ''
  if (!/^\d+$/.test(value) || Number(value) < 1) throw new TypeError('Mã phải là số nguyên dương.')
  return value
}

function code(value) {
  const text = String(value ?? '').trim()
  if (!text) throw new TypeError('Mã không được để trống.')
  return encodeURIComponent(text)
}

// Cửa sổ TOTP gắn với access token đã verify; đổi token thì phải verify lại.
let totpWindow = { token: null, until: 0 }

function markTotpVerified(expiresIn) {
  const seconds = Number(expiresIn) > 0 ? Number(expiresIn) : 600
  totpWindow = { token: getAuthSession()?.accessToken ?? null, until: Date.now() + seconds * 1000 }
}

function totpRemaining() {
  const token = getAuthSession()?.accessToken
  if (!token || totpWindow.token !== token) return 0
  return Math.max(0, Math.round((totpWindow.until - Date.now()) / 1000))
}

export function isTotpRequiredError(error) {
  return error instanceof ApiError && error.status === 403 && /totp/i.test(error.message)
}

async function writeAdmin(path, method, body) {
  const session = signedInSession()
  const allowed = await accessForSession(session)
  assertCurrentSession(session)
  if (!allowed) {
    throw new ApiError('Tài khoản này chưa được cấp quyền vào trang quản trị.', { status: 403 })
  }
  try {
    const result = await apiRequest(path, { method, body })
    assertCurrentSession(session)
    return result
  } catch (error) {
    if (isTotpRequiredError(error)) totpWindow = { token: null, until: 0 }
    throw error
  }
}
