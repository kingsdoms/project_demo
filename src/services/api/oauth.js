import { ApiError, apiRequest } from './client.js'

const PROVIDER_PATTERN = /^[a-z]+$/

function providerPath(provider) {
  const value = String(provider ?? '').toLowerCase()
  if (!PROVIDER_PATTERN.test(value)) throw new TypeError('Nhà cung cấp đăng nhập không hợp lệ.')
  return encodeURIComponent(value)
}

let providersRequest = null

export const oauthApi = {
  /** Danh sách provider; cache theo trang vì client_id ít thay đổi. */
  providers({ force = false } = {}) {
    if (!providersRequest || force) {
      providersRequest = apiRequest('/oauth/providers', { auth: false })
        .then((value) => {
          if (!Array.isArray(value)) throw new ApiError('Máy chủ trả về danh sách nhà cung cấp không hợp lệ.')
          return value
        })
        .catch((error) => {
          providersRequest = null
          throw error
        })
    }
    return providersRequest
  },

  async provider(typeCode) {
    const list = await oauthApi.providers()
    return list.find((item) => String(item.type_code).toUpperCase() === String(typeCode).toUpperCase()) ?? null
  },

  login(provider, { credential, ticket, link_code } = {}) {
    const body = ticket ? { ticket, link_code } : { credential }
    return apiRequest(`/oauth/login/${providerPath(provider)}`, { method: 'POST', auth: false, body })
  },

  requestLinkCode(accessToken) {
    return apiRequest('/oauth/link-code', { auth: false, authToken: accessToken })
  },

  link(provider, credential) {
    return apiRequest(`/oauth/link/${providerPath(provider)}`, { method: 'POST', body: { credential } })
  },

  async accounts() {
    const value = await apiRequest('/oauth/accounts')
    return Array.isArray(value) ? value.map((item) => String(item).toUpperCase()) : []
  },

  unlink(typeCode) {
    return apiRequest(`/oauth/accounts/${encodeURIComponent(String(typeCode).toUpperCase())}`, { method: 'DELETE' })
  },
}
