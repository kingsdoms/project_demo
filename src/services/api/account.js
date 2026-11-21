import { apiRequest, getAuthSession } from './client.js'

let profileRequest = null

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
  update: ({ name }) => apiRequest('/account/me', { method: 'PUT', body: { name } }),
  changePassword: ({ value, old_value, code_tfa }) => apiRequest('/account/change-password', {
    method: 'POST', body: { value, old_value, code_tfa },
  }),
}
