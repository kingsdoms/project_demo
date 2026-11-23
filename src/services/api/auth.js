import {
  apiRequest,
  clearAuthSession,
  getAuthSession,
} from './client.js'

export function isSameAuthSession(first, second) {
  if (!first || !second) return first === second
  if (first.refreshToken || second.refreshToken) {
    return Boolean(first.refreshToken && first.refreshToken === second.refreshToken)
  }
  return Boolean(first.accessToken && first.accessToken === second.accessToken)
}

export const authApi = {
  login({ identifier, password, token }) {
    return apiRequest('/auth/login', {
      method: 'POST',
      auth: false,
      body: {
        identifier,
        password,
        ...(token ? { token } : {}),
      },
    })
  },

  register({ name, username, email, password, re_password }) {
    return apiRequest('/auth/register', {
      method: 'POST',
      auth: false,
      body: { name, username, email, password, re_password },
    })
  },

  requestOtp(accessToken, purpose = 'LOGIN') {
    return apiRequest(`/account/otp?purpose=${encodeURIComponent(purpose)}`, {
      auth: false,
      authToken: accessToken,
    })
  },

  requestActivation(accessToken) {
    return apiRequest('/account/active', {
      auth: false,
      authToken: accessToken,
    })
  },

  requestPasswordReset(identifier) {
    return apiRequest(`/account/forgot-password/${encodeURIComponent(identifier)}`, { auth: false })
  },

  resetPassword({ token, password, re_password }) {
    return apiRequest('/account/forgot-password', {
      method: 'POST', auth: false, body: { token, password, re_password },
    })
  },

  async logout({ all = false } = {}) {
    const session = getAuthSession()
    try {
      if (session?.accessToken && session.refreshToken) {
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: all ? { refresh_token: session.refreshToken, all: true } : { refresh_token: session.refreshToken },
        })
      }
    } finally {
      if (isSameAuthSession(getAuthSession(), session)) clearAuthSession()
    }
  },
}
