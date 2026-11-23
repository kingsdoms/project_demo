import { apiRequest, getAuthSession } from './client.js'

let profileRequest = null

function pick(source, keys) {
  const out = {}
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key]
  return out
}

export const OTP_PURPOSE = Object.freeze({
  LOGIN: 'LOGIN',
  CHANGE_EMAIL: 'CHANGE_EMAIL',
  CHANGE_PHONE: 'CHANGE_PHONE',
  CHANGE_PASSWORD: 'CHANGE_PASSWORD',
  CHANGE_TFA: 'CHANGE_TFA',
  DELETE_ACCOUNT: 'DELETE_ACCOUNT',
})

export const AVATAR_MAX_BYTES = 2048 * 1024

export const accountApi = {
  me() {
    const key = getAuthSession()?.refreshToken || getAuthSession()?.accessToken
    if (profileRequest && profileRequest.key === key) return profileRequest.promise
    const promise = apiRequest('/account/me').finally(() => {
      if (profileRequest?.promise === promise) profileRequest = null
    })
    profileRequest = { key, promise }
    return promise
  },
  update: (fields) => apiRequest('/account/me', {
    method: 'PUT', body: pick(fields ?? {}, ['name', 'birth_day', 'gender']),
  }),
  requestOtp: (purpose) => apiRequest(`/account/otp?purpose=${encodeURIComponent(purpose)}`),
  changePassword: ({ value, old_value, code_tfa }) => apiRequest('/account/change-password', {
    method: 'POST', body: { value, old_value, code_tfa },
  }),
  changeEmail: ({ value, code_tfa }) => apiRequest('/account/change-email', {
    method: 'POST', body: { value, code_tfa },
  }),
  changePhone: ({ value, code_tfa }) => apiRequest('/account/change-phone', {
    method: 'POST', body: { value, code_tfa },
  }),
  changeTfa: ({ value, code_tfa }) => apiRequest('/account/change-enable_tfa', {
    method: 'POST', body: { value: Boolean(value), code_tfa },
  }),
  setCredentials: ({ username, password, re_password }) => apiRequest('/account/set-credentials', {
    method: 'POST', body: { username, password, re_password },
  }),
  uploadAvatar(file) {
    const form = new FormData()
    form.append('avatar', file)
    return apiRequest('/account/upload-avatar', { method: 'POST', body: form })
  },
  deleteAccount: ({ code_tfa }) => apiRequest('/account/delete', {
    method: 'POST', body: { code_tfa },
  }),
}
